import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// One refresh request at a time: the server rotates the refresh secret on every
// call and ends a session when a secret is presented twice, so two requests
// that run together (a 401 and the proactive timer, or two browser tabs) would
// log the user out.

const { post } = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/services/api', () => ({ default: { post } }))

type LockTask = () => Promise<string>

// A lock manager shared by "tabs" (separate module instances): requests for one
// name run strictly one after the other, in the order they were made.
function makeLockManager() {
  const queues = new Map<string, Promise<unknown>>()
  const request = vi.fn(async (name: string, task: LockTask) => {
    const previous = queues.get(name) ?? Promise.resolve()
    const run = previous.catch(() => undefined).then(task)
    queues.set(name, run)
    return run
  })
  return { request }
}

function installLocks(manager: ReturnType<typeof makeLockManager> | undefined) {
  Object.defineProperty(navigator, 'locks', { value: manager, configurable: true })
}

async function loadModule() {
  return await import('@/services/sessionRefresh')
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('refreshAccessToken', () => {
  beforeEach(() => {
    vi.resetModules()
    post.mockReset()
    installLocks(undefined)
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'locks')
  })

  it('returns the access token of the refresh response', async () => {
    post.mockResolvedValue({ data: { access_token: 'fresh-token' } })
    const { refreshAccessToken } = await loadModule()

    await expect(refreshAccessToken()).resolves.toBe('fresh-token')
  })

  it('posts to the refresh endpoint with a timeout, so a hung request cannot hold the lock for ever', async () => {
    post.mockResolvedValue({ data: { access_token: 't' } })
    const { refreshAccessToken, REFRESH_TIMEOUT_MS } = await loadModule()

    await refreshAccessToken()

    expect(post).toHaveBeenCalledWith('/auth/refresh', undefined, { timeout: REFRESH_TIMEOUT_MS })
    expect(REFRESH_TIMEOUT_MS).toBeGreaterThan(0)
  })

  describe('inside one tab', () => {
    it('lets callers that arrive while a refresh runs share its request', async () => {
      const gate = deferred<{ data: { access_token: string } }>()
      post.mockReturnValue(gate.promise)
      const { refreshAccessToken } = await loadModule()

      const first = refreshAccessToken()
      const second = refreshAccessToken()
      const third = refreshAccessToken()
      gate.resolve({ data: { access_token: 'shared' } })

      await expect(Promise.all([first, second, third])).resolves.toEqual([
        'shared',
        'shared',
        'shared',
      ])
      expect(post).toHaveBeenCalledTimes(1)
    })

    it('starts a new request for a caller that arrives after the refresh has finished', async () => {
      post
        .mockResolvedValueOnce({ data: { access_token: 'one' } })
        .mockResolvedValueOnce({ data: { access_token: 'two' } })
      const { refreshAccessToken } = await loadModule()

      const first = await refreshAccessToken()
      const second = await refreshAccessToken()

      expect([first, second]).toEqual(['one', 'two'])
      expect(post).toHaveBeenCalledTimes(2)
    })

    it('rejects every waiting caller when the refresh fails', async () => {
      const gate = deferred<never>()
      post.mockReturnValue(gate.promise)
      const { refreshAccessToken } = await loadModule()

      const results = Promise.allSettled([refreshAccessToken(), refreshAccessToken()])
      gate.reject(new Error('refresh failed'))

      const settled = await results
      expect(settled.map((r) => r.status)).toEqual(['rejected', 'rejected'])
      expect(post).toHaveBeenCalledTimes(1)
    })

    it('tries again after a failed refresh', async () => {
      post
        .mockRejectedValueOnce(new Error('outage'))
        .mockResolvedValueOnce({ data: { access_token: 'recovered' } })
      const { refreshAccessToken } = await loadModule()

      await expect(refreshAccessToken()).rejects.toThrow('outage')

      await expect(refreshAccessToken()).resolves.toBe('recovered')
    })
  })

  describe('across browser tabs', () => {
    it('asks the browser for the lock of that name when it is available', async () => {
      const locks = makeLockManager()
      installLocks(locks)
      post.mockResolvedValue({ data: { access_token: 't' } })
      const { refreshAccessToken, REFRESH_LOCK_NAME } = await loadModule()

      await refreshAccessToken()

      expect(locks.request).toHaveBeenCalledTimes(1)
      expect(locks.request.mock.calls[0]?.[0]).toBe(REFRESH_LOCK_NAME)
      expect(REFRESH_LOCK_NAME).not.toBe('')
    })

    it('never lets the refresh requests of two tabs overlap', async () => {
      const locks = makeLockManager()
      installLocks(locks)
      let running = 0
      let maxRunning = 0
      const gates: Array<ReturnType<typeof deferred<{ data: { access_token: string } }>>> = []
      post.mockImplementation(async () => {
        running++
        maxRunning = Math.max(maxRunning, running)
        const gate = deferred<{ data: { access_token: string } }>()
        gates.push(gate)
        try {
          return await gate.promise
        } finally {
          running--
        }
      })

      // Two tabs are two separate module instances in the same browser.
      const tabA = await loadModule()
      vi.resetModules()
      const tabB = await loadModule()

      const fromA = tabA.refreshAccessToken()
      const fromB = tabB.refreshAccessToken()
      await vi.waitFor(() => expect(gates).toHaveLength(1))
      // The second tab waits for the lock: its request has not started.
      expect(post).toHaveBeenCalledTimes(1)

      gates[0]?.resolve({ data: { access_token: 'from-a' } })
      await vi.waitFor(() => expect(gates).toHaveLength(2))
      gates[1]?.resolve({ data: { access_token: 'from-b' } })

      await expect(Promise.all([fromA, fromB])).resolves.toEqual(['from-a', 'from-b'])
      expect(maxRunning).toBe(1)
    })

    it('lets the second tab continue after the first tab failed', async () => {
      const locks = makeLockManager()
      installLocks(locks)
      post
        .mockRejectedValueOnce(new Error('first failed'))
        .mockResolvedValueOnce({ data: { access_token: 'second-ok' } })
      const tabA = await loadModule()
      vi.resetModules()
      const tabB = await loadModule()

      const results = await Promise.allSettled([
        tabA.refreshAccessToken(),
        tabB.refreshAccessToken(),
      ])

      expect(results[0]?.status).toBe('rejected')
      expect(results[1]).toEqual({ status: 'fulfilled', value: 'second-ok' })
    })

    it('refreshes without the lock when the browser refuses to grant it', async () => {
      const locks = makeLockManager()
      locks.request.mockRejectedValueOnce(new DOMException('opaque origin', 'SecurityError'))
      installLocks(locks)
      post.mockResolvedValue({ data: { access_token: 'unlocked' } })
      const { refreshAccessToken } = await loadModule()

      await expect(refreshAccessToken()).resolves.toBe('unlocked')
      expect(post).toHaveBeenCalledTimes(1)
    })

    it('does not send a second request when the refresh itself failed inside the lock', async () => {
      const locks = makeLockManager()
      installLocks(locks)
      post.mockRejectedValue(new Error('refresh failed'))
      const { refreshAccessToken } = await loadModule()

      await expect(refreshAccessToken()).rejects.toThrow('refresh failed')
      expect(post).toHaveBeenCalledTimes(1)
    })

    it('still works in browsers without the Web Locks API', async () => {
      installLocks(undefined)
      post.mockResolvedValue({ data: { access_token: 'no-locks' } })
      const { refreshAccessToken } = await loadModule()

      await expect(refreshAccessToken()).resolves.toBe('no-locks')
    })
  })
})
