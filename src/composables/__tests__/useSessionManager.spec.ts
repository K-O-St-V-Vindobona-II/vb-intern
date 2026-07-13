import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { useSessionManager } from '../useSessionManager'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockLogout = vi.fn().mockResolvedValue(undefined)
const mockAuthStore = {
  token: null as string | null,
  user: { session_idle_timeout: 30 } as any,
  logout: mockLogout,
  setToken: vi.fn((newToken: string) => {
    mockAuthStore.token = newToken
  }),
}
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

vi.mock('@/services/api', () => ({
  default: {
    post: vi.fn().mockRejectedValue(new Error('refresh failed')),
    defaults: { baseURL: '' },
  },
}))

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.signature`
}

let activeWrapper: ReturnType<typeof mount> | null = null

function mountComposable() {
  let result!: ReturnType<typeof useSessionManager>
  const wrapper = mount(
    defineComponent({
      setup() {
        result = useSessionManager()
        return {}
      },
      template: '<div />',
    }),
  )
  activeWrapper = wrapper
  return { wrapper, result }
}

describe('useSessionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockAuthStore.token = null
    mockAuthStore.user = { session_idle_timeout: 30 }
  })

  afterEach(() => {
    activeWrapper?.unmount()
    activeWrapper = null
    vi.useRealTimers()
  })

  it('parses login time from JWT iat claim', () => {
    const iat = Math.floor(new Date('2026-06-25T10:00:00Z').getTime() / 1000)
    mockAuthStore.token = makeJwt({ iat, exp: iat + 3600, sub: 'test' })

    const { result } = mountComposable()

    expect(result.loginTime.value).toContain('25.06.2026')
  })

  it('attempts refresh when token expires instead of logging out', async () => {
    const now = Math.floor(Date.now() / 1000)
    mockAuthStore.token = makeJwt({ iat: now, exp: now + 120, sub: 'test' })

    mountComposable()

    vi.advanceTimersByTime(120_000)
    await nextTick()

    const api = (await import('@/services/api')).default
    expect(api.post).toHaveBeenCalledWith('/auth/refresh')
  })

  it('auto-logs out after idle timeout', async () => {
    const now = Math.floor(Date.now() / 1000)
    mockAuthStore.token = makeJwt({ iat: now, exp: now + 7200, sub: 'test' })
    mockAuthStore.user = { session_idle_timeout: 5 }

    mountComposable()

    vi.advanceTimersByTime(5 * 60_000)
    await nextTick()

    expect(mockLogout).toHaveBeenCalledOnce()
    expect(mockPush).toHaveBeenCalledWith({ name: 'login' })
  })

  it('resets idle timer on user activity', async () => {
    const now = Math.floor(Date.now() / 1000)
    mockAuthStore.token = makeJwt({ iat: now, exp: now + 7200, sub: 'test' })
    mockAuthStore.user = { session_idle_timeout: 5 }

    mountComposable()

    vi.advanceTimersByTime(4 * 60_000)
    document.dispatchEvent(new Event('mousemove'))
    vi.advanceTimersByTime(4 * 60_000)
    await nextTick()

    expect(mockLogout).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2 * 60_000)
    await nextTick()

    expect(mockLogout).toHaveBeenCalledOnce()
  })

  it('debounces rapid activity events', async () => {
    const now = Math.floor(Date.now() / 1000)
    mockAuthStore.token = makeJwt({ iat: now, exp: now + 7200, sub: 'test' })
    mockAuthStore.user = { session_idle_timeout: 1 }

    mountComposable()

    for (let i = 0; i < 100; i++) {
      document.dispatchEvent(new Event('mousemove'))
    }

    vi.advanceTimersByTime(60_000)
    await nextTick()

    expect(mockLogout).toHaveBeenCalledOnce()
  })

  it('refreshes via the periodic fallback check if the token is already expired', async () => {
    const now = Math.floor(Date.now() / 1000)
    mockAuthStore.token = makeJwt({ iat: now - 3600, exp: now - 1, sub: 'test' })

    mountComposable()

    vi.advanceTimersByTime(60_000)
    await nextTick()

    const api = (await import('@/services/api')).default
    expect(api.post).toHaveBeenCalledWith('/auth/refresh')
  })

  it('cleans up timers and listeners on unmount', () => {
    const now = Math.floor(Date.now() / 1000)
    mockAuthStore.token = makeJwt({ iat: now, exp: now + 3600, sub: 'test' })
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const { wrapper } = mountComposable()
    wrapper.unmount()

    const removedEvents = removeSpy.mock.calls.map((c) => c[0])
    expect(removedEvents).toContain('mousemove')
    expect(removedEvents).toContain('keydown')
    expect(removedEvents).toContain('scroll')

    removeSpy.mockRestore()
  })

  it('handles missing token gracefully', () => {
    const { result } = mountComposable()

    expect(result.loginTime.value).toBe('')
  })

  it('treats an unparsable token payload as empty instead of throwing', () => {
    mockAuthStore.token = 'a.!!!not-valid-base64!!!.c'

    const { result } = mountComposable()

    expect(result.loginTime.value).toBe('')
  })

  it('applies the refreshed token and reschedules instead of logging out on a successful proactive refresh', async () => {
    const now = Math.floor(Date.now() / 1000)
    mockAuthStore.token = makeJwt({ iat: now, exp: now + 120, sub: 'test' })
    const refreshedToken = makeJwt({ iat: now + 120, exp: now + 120 + 7200, sub: 'test' })

    // Both the dedicated refresh timer and the periodic expiry fallback
    // check can independently trigger a refresh around the same simulated
    // tick, so every call must succeed, not just the first.
    const api = (await import('@/services/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: { access_token: refreshedToken } })

    mountComposable()

    vi.advanceTimersByTime(120_000)
    await nextTick()

    expect(api.post).toHaveBeenCalledWith('/auth/refresh')
    expect(mockAuthStore.setToken).toHaveBeenCalledWith(refreshedToken)
    expect(mockLogout).not.toHaveBeenCalled()
  })

  it('defaults idle timeout to 30 minutes when user has no setting', async () => {
    const now = Math.floor(Date.now() / 1000)
    mockAuthStore.token = makeJwt({ iat: now, exp: now + 7200, sub: 'test' })
    mockAuthStore.user = null

    mountComposable()

    vi.advanceTimersByTime(29 * 60_000)
    await nextTick()
    expect(mockLogout).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2 * 60_000)
    await nextTick()
    expect(mockLogout).toHaveBeenCalledOnce()
  })
})
