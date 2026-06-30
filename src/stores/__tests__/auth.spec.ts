import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import authService from '@/services/authService'
import memberService from '@/services/memberService'
import api from '@/services/api'

vi.mock('@/services/authService')
vi.mock('@/services/memberService')
vi.mock('@/services/api', () => ({
  default: {
    post: vi.fn(),
    defaults: { baseURL: '' },
  },
}))

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should initialize with empty values', () => {
    const store = useAuthStore()
    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
  })

  it('should save token and fetch user on login()', async () => {
    const store = useAuthStore()

    // Provide fake data for mocked services
    vi.mocked(authService.login).mockResolvedValue('fake-jwt')
    vi.mocked(memberService.getCurrentUser).mockResolvedValue({ vorname: 'Max' })

    await store.login(new URLSearchParams())

    expect(store.token).toBe('fake-jwt')
    expect(store.user).toEqual({ vorname: 'Max' })
  })

  it('should clear state and notify backend on logout()', async () => {
    const store = useAuthStore()
    store.token = 'old-token'

    await store.logout()

    expect(authService.logout).toHaveBeenCalledOnce()
    expect(store.token).toBeNull()
  })

  it('should save token and fetch user on googleLogin()', async () => {
    const store = useAuthStore()

    vi.mocked(authService.loginWithGoogle).mockResolvedValue('google-jwt')
    vi.mocked(memberService.getCurrentUser).mockResolvedValue({ vorname: 'Google User' })

    await store.googleLogin('google-credential')

    expect(authService.loginWithGoogle).toHaveBeenCalledWith('google-credential')
    expect(store.token).toBe('google-jwt')
    expect(store.user).toEqual({ vorname: 'Google User' })
  })

  it('should successfully link account via linkGoogle()', async () => {
    const store = useAuthStore()

    vi.mocked(authService.linkGoogleAccount).mockResolvedValue('linked-jwt')
    vi.mocked(memberService.getCurrentUser).mockResolvedValue({ vorname: 'Linked User' })

    await store.linkGoogle({ credential: 'c', email: 'e', password: 'p' })

    expect(authService.linkGoogleAccount).toHaveBeenCalledOnce()
    expect(store.token).toBe('linked-jwt')
  })

  it('should unlink account and refresh user profile on unlinkGoogle()', async () => {
    const store = useAuthStore()

    // Simulate active session since fetchUser() requires a token
    store.token = 'dummy-token'

    await store.unlinkGoogle()

    expect(authService.unlinkGoogleAccount).toHaveBeenCalledOnce()
    expect(memberService.getCurrentUser).toHaveBeenCalledOnce()
  })

  it('should not call the API or fetch user when fetchUser is called without a token', async () => {
    const store = useAuthStore()

    await store.fetchUser()

    expect(memberService.getCurrentUser).not.toHaveBeenCalled()
  })

  it('should restore session, fetch user and reset isRestoringSession on success', async () => {
    const store = useAuthStore()

    vi.mocked(api.post).mockResolvedValue({ data: { access_token: 'restored-jwt' } })
    vi.mocked(memberService.getCurrentUser).mockResolvedValue({ vorname: 'Restored' })

    const result = await store.restoreSession()

    expect(result).toBe(true)
    expect(api.post).toHaveBeenCalledWith('/auth/refresh')
    expect(store.token).toBe('restored-jwt')
    expect(store.user).toEqual({ vorname: 'Restored' })
    expect(store.isRestoringSession).toBe(false)
  })

  it('should clear auth and return false when session restore fails', async () => {
    const store = useAuthStore()
    store.token = 'stale-token'

    vi.mocked(api.post).mockRejectedValue(new Error('refresh token expired'))

    const result = await store.restoreSession()

    expect(result).toBe(false)
    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(store.isRestoringSession).toBe(false)
  })

  it('should log an error when fetchUser fails', async () => {
    const store = useAuthStore()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    store.token = 'dummy-token'
    vi.mocked(memberService.getCurrentUser).mockRejectedValue(new Error('network error'))

    await store.fetchUser()

    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch user profile.')
    consoleSpy.mockRestore()
  })

  it('should log a warning and still clear auth when backend logout fails', async () => {
    const store = useAuthStore()
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    store.token = 'old-token'
    vi.mocked(authService.logout).mockRejectedValue(new Error('already expired'))

    await store.logout()

    expect(consoleSpy).toHaveBeenCalledWith(
      'Backend session could not be destroyed or already expired.',
    )
    expect(store.token).toBeNull()
    consoleSpy.mockRestore()
  })
})
