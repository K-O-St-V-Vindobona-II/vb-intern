import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { AxiosRequestConfig, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

const { mockPush, mockCurrentRoute } = vi.hoisted(() => ({
  mockPush: vi.fn().mockResolvedValue(undefined),
  mockCurrentRoute: {
    value: { name: 'dashboard' as string | undefined, fullPath: '/dashboard' },
  },
}))
vi.mock('@/router', () => ({
  default: {
    currentRoute: mockCurrentRoute,
    push: mockPush,
  },
}))

vi.mock('@/services/memberService', () => ({
  default: { getCurrentUser: vi.fn().mockResolvedValue({ id: 1 }) },
}))

import api from '@/services/api'
import { refreshAccessToken, REFRESH_TIMEOUT_MS } from '@/services/sessionRefresh'
import { useAuthStore } from '@/stores/auth'
import { useLoadingStore } from '@/stores/loading'
import memberService from '@/services/memberService'

function makeResponse(config: InternalAxiosRequestConfig, data: unknown = {}): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config }
}

function makeError(config: InternalAxiosRequestConfig, status: number, data: unknown = {}) {
  const error = new Error(`Request failed with status ${status}`) as Error & {
    config: InternalAxiosRequestConfig
    response: { status: number; data: unknown; config: InternalAxiosRequestConfig }
    isAxiosError: boolean
  }
  error.config = config
  error.response = { status, data, config }
  error.isAxiosError = true
  return error
}

function makeNetworkError(config: InternalAxiosRequestConfig) {
  const error = new Error('Network Error') as Error & {
    config: InternalAxiosRequestConfig
    request: object
  }
  error.config = config
  error.request = {}
  return error
}

describe('api (axios interceptors)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockClear()
    mockCurrentRoute.value = { name: 'dashboard', fullPath: '/dashboard' }
    vi.mocked(memberService.getCurrentUser).mockClear()
    vi.mocked(memberService.getCurrentUser).mockResolvedValue({ id: 1 } as never)
  })

  it('adds the Authorization header when a token is present', async () => {
    const authStore = useAuthStore()
    authStore.setToken('test-token')
    let capturedConfig: InternalAxiosRequestConfig | undefined
    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      capturedConfig = config
      return makeResponse(config)
    })

    await api.get('/ping')

    expect(capturedConfig?.headers.Authorization).toBe('Bearer test-token')
  })

  it('does not add an Authorization header without a token', async () => {
    let capturedConfig: InternalAxiosRequestConfig | undefined
    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      capturedConfig = config
      return makeResponse(config)
    })

    await api.get('/ping')

    expect(capturedConfig?.headers.Authorization).toBeUndefined()
  })

  it('starts and stops the loading indicator around a successful request', async () => {
    const loadingStore = useLoadingStore()
    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => makeResponse(config))
    const startSpy = vi.spyOn(loadingStore, 'startLoading')
    const stopSpy = vi.spyOn(loadingStore, 'stopLoading')

    await api.get('/ping')

    expect(startSpy).toHaveBeenCalledOnce()
    expect(stopSpy).toHaveBeenCalledOnce()
  })

  it('refreshes the token and retries the original request on a 401', async () => {
    const authStore = useAuthStore()
    authStore.setToken('expired-token')
    let protectedCalls = 0

    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/protected') {
        protectedCalls++
        if (protectedCalls === 1) throw makeError(config, 401, { detail: 'expired' })
        return makeResponse(config, { ok: true })
      }
      if (config.url === '/auth/refresh') {
        return makeResponse(config, { access_token: 'new-token' })
      }
      throw new Error(`unexpected url ${String(config.url)}`)
    })

    const response = await api.get('/protected')

    expect(response.data).toEqual({ ok: true })
    expect(authStore.token).toBe('new-token')
    expect(protectedCalls).toBe(2)
  })

  it('clears auth and redirects to login when the refresh call itself fails', async () => {
    const authStore = useAuthStore()
    authStore.setToken('expired-token')

    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/protected') throw makeError(config, 401, { detail: 'expired' })
      // A non-401 failure (e.g. backend outage) keeps this isolated from the
      // dedicated /auth/refresh-returns-401 path tested separately below.
      if (config.url === '/auth/refresh') throw makeError(config, 500, { detail: 'refresh failed' })
      throw new Error(`unexpected url ${String(config.url)}`)
    })

    await expect(api.get('/protected')).rejects.toBeTruthy()

    expect(authStore.token).toBeNull()
    expect(mockPush).toHaveBeenCalledWith({ name: 'login', query: { redirect: '/dashboard' } })
  })

  it('redirects directly to login without retrying when the refresh request itself returns 401', async () => {
    const authStore = useAuthStore()
    authStore.setToken('expired-token')

    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw makeError(config, 401, { detail: 'no session' })
    })

    await expect(api.post('/auth/refresh')).rejects.toBeTruthy()

    expect(authStore.token).toBeNull()
    expect(mockPush).toHaveBeenCalledWith({ name: 'login', query: { redirect: '/dashboard' } })
  })

  it('does not redirect again when already on the login page', async () => {
    mockCurrentRoute.value = { name: 'login', fullPath: '/login' }
    const authStore = useAuthStore()
    authStore.setToken('expired-token')

    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw makeError(config, 401, { detail: 'no session' })
    })

    await expect(api.post('/auth/refresh')).rejects.toBeTruthy()

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('refreshes the cached user but does not navigate away on a 403', async () => {
    const authStore = useAuthStore()
    authStore.setToken('valid-token')

    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw makeError(config, 403, { detail: 'forbidden' })
    })

    await expect(api.get('/forbidden')).rejects.toBeTruthy()

    expect(memberService.getCurrentUser).toHaveBeenCalledOnce()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('clears auth and redirects to login on a network error while authenticated', async () => {
    const authStore = useAuthStore()
    authStore.setToken('valid-token')

    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw makeNetworkError(config)
    })

    await expect(api.get('/offline')).rejects.toBeTruthy()

    expect(authStore.token).toBeNull()
    expect(mockPush).toHaveBeenCalledWith({ name: 'login', query: { redirect: '/dashboard' } })
  })

  it('does not clear auth or redirect on a network error when not authenticated', async () => {
    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw makeNetworkError(config)
    })

    await expect(api.get('/offline')).rejects.toBeTruthy()

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('queues a concurrent request while a refresh is in progress and resolves it with the new token', async () => {
    const authStore = useAuthStore()
    authStore.setToken('expired-token')

    let refreshResolve: () => void = () => {}
    const refreshGate = new Promise<void>((resolve) => {
      refreshResolve = resolve
    })

    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        await refreshGate
        return makeResponse(config, { access_token: 'new-token' })
      }
      if (config.url?.startsWith('/protected')) {
        const isStale = config.headers.Authorization !== 'Bearer new-token'
        if (isStale) throw makeError(config, 401, { detail: 'expired' })
        return makeResponse(config, { url: config.url })
      }
      throw new Error(`unexpected url ${String(config.url)}`)
    })

    const requestA = api.get('/protected/a')
    const requestB = api.get('/protected/b')

    // Let both initial 401s resolve and the refresh call start before completing it.
    await Promise.resolve()
    await Promise.resolve()
    refreshResolve()

    const [resA, resB] = await Promise.all([requestA, requestB])

    expect(resA.data).toEqual({ url: '/protected/a' })
    expect(resB.data).toEqual({ url: '/protected/b' })
    expect(authStore.token).toBe('new-token')
  })

  it('sends exactly one refresh request for several requests that get a 401 together', async () => {
    useAuthStore().setToken('expired-token')
    let refreshCalls = 0
    let releaseRefresh: () => void = () => {}
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        refreshCalls++
        await refreshGate
        return makeResponse(config, { access_token: 'new-token' })
      }
      if (config.headers.Authorization !== 'Bearer new-token') {
        throw makeError(config, 401, { detail: 'expired' })
      }
      return makeResponse(config, { url: config.url })
    })

    const requests = [api.get('/a'), api.get('/b'), api.get('/c'), api.get('/d')]
    await vi.waitFor(() => expect(refreshCalls).toBe(1))
    releaseRefresh()
    const responses = await Promise.all(requests)

    expect(refreshCalls).toBe(1)
    expect(responses.map((r) => r.data.url)).toEqual(['/a', '/b', '/c', '/d'])
  })

  it('shares one refresh request between a refresh started by the session timer and a 401', async () => {
    useAuthStore().setToken('expired-token')
    let refreshCalls = 0
    let releaseRefresh: () => void = () => {}
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        refreshCalls++
        await refreshGate
        return makeResponse(config, { access_token: 'new-token' })
      }
      if (config.headers.Authorization !== 'Bearer new-token') {
        throw makeError(config, 401, { detail: 'expired' })
      }
      return makeResponse(config, { ok: true })
    })

    const fromTimer = refreshAccessToken()
    await vi.waitFor(() => expect(refreshCalls).toBe(1))
    const protectedRequest = api.get('/protected')
    await vi.waitFor(() => expect(api.defaults.adapter).toHaveBeenCalledTimes(2))
    releaseRefresh()

    await expect(fromTimer).resolves.toBe('new-token')
    await expect(protectedRequest).resolves.toMatchObject({ data: { ok: true } })
    expect(refreshCalls).toBe(1)
  })

  it('fails every request that waits for a refresh when the refresh fails', async () => {
    const authStore = useAuthStore()
    authStore.setToken('expired-token')
    let refreshCalls = 0
    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        refreshCalls++
        await Promise.resolve()
        throw makeError(config, 500, { detail: 'outage' })
      }
      throw makeError(config, 401, { detail: 'expired' })
    })

    const results = await Promise.allSettled([api.get('/a'), api.get('/b'), api.get('/c')])

    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected'])
    expect(refreshCalls).toBe(1)
    expect(authStore.token).toBeNull()
  })

  it('limits the time a refresh request may take', async () => {
    useAuthStore().setToken('expired-token')
    let refreshTimeout: number | undefined
    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        refreshTimeout = config.timeout
        return makeResponse(config, { access_token: 'new-token' })
      }
      if (config.headers.Authorization !== 'Bearer new-token') {
        throw makeError(config, 401, { detail: 'expired' })
      }
      return makeResponse(config)
    })

    await api.get('/protected')

    expect(refreshTimeout).toBe(REFRESH_TIMEOUT_MS)
  })

  it('does not try a second refresh when the retried request is rejected with a 401 again', async () => {
    const authStore = useAuthStore()
    authStore.setToken('expired-token')
    let refreshCalls = 0

    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        refreshCalls++
        // Cap the refreshes so a missing retry guard fails the assertion below
        // instead of looping until the worker runs out of memory.
        if (refreshCalls > 3) throw makeError(config, 500, { detail: 'refresh loop' })
        return makeResponse(config, { access_token: 'new-token' })
      }
      throw makeError(config, 401, { detail: 'still not allowed' })
    })

    await expect(api.get('/protected')).rejects.toMatchObject({ response: { status: 401 } })

    expect(refreshCalls).toBe(1)
  })

  it('rejects a 401 for a request that was already retried without refreshing again', async () => {
    const authStore = useAuthStore()
    authStore.setToken('expired-token')
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw makeError(config, 401, { detail: 'expired' })
    })
    api.defaults.adapter = adapter

    await expect(
      api.get('/protected', { _retry: true } as AxiosRequestConfig),
    ).rejects.toMatchObject({ response: { status: 401 } })

    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('rejects a 401 that carries no request configuration with the original error', async () => {
    const authStore = useAuthStore()
    authStore.setToken('expired-token')
    const error = Object.assign(new Error('Request failed with status 401'), {
      response: { status: 401, data: {} },
      isAxiosError: true,
    })
    const adapter = vi.fn(async () => {
      throw error
    })
    api.defaults.adapter = adapter

    await expect(api.get('/protected')).rejects.toBe(error)

    expect(adapter).toHaveBeenCalledTimes(1)
  })
})
