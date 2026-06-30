import { describe, it, expect, vi, beforeEach } from 'vitest'
import authService from '@/services/authService'

const mockPost = vi.fn()
const mockDelete = vi.fn()
vi.mock('@/services/api', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

describe('authService', () => {
  beforeEach(() => {
    mockPost.mockReset()
    mockDelete.mockReset()
  })

  it('login posts form-urlencoded credentials and returns the access token', async () => {
    mockPost.mockResolvedValueOnce({ data: { access_token: 'jwt-token' } })
    const formData = new URLSearchParams({ username: 'a@b.at', password: 'secret' })

    const token = await authService.login(formData)

    expect(token).toBe('jwt-token')
    expect(mockPost).toHaveBeenCalledWith('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  })

  it('logout posts to /auth/logout', async () => {
    mockPost.mockResolvedValueOnce({})
    await authService.logout()
    expect(mockPost).toHaveBeenCalledWith('/auth/logout')
  })

  it('requestPasswordReset posts the email', async () => {
    mockPost.mockResolvedValueOnce({})
    await authService.requestPasswordReset('a@b.at')
    expect(mockPost).toHaveBeenCalledWith('/auth/forgot-password', { email: 'a@b.at' })
  })

  it('executePasswordReset posts the full payload', async () => {
    mockPost.mockResolvedValueOnce({})
    const payload = { email: 'a@b.at', token: 'reset-token', password: 'newpass' }
    await authService.executePasswordReset(payload)
    expect(mockPost).toHaveBeenCalledWith('/auth/reset-password', payload)
  })

  it('loginWithGoogle posts the credential and returns the access token', async () => {
    mockPost.mockResolvedValueOnce({ data: { access_token: 'google-jwt' } })
    const token = await authService.loginWithGoogle('google-credential')
    expect(token).toBe('google-jwt')
    expect(mockPost).toHaveBeenCalledWith('/auth/google', { credential: 'google-credential' })
  })

  it('linkGoogleAccount posts the payload and returns the access token', async () => {
    mockPost.mockResolvedValueOnce({ data: { access_token: 'linked-jwt' } })
    const payload = { credential: 'c', email: 'a@b.at', password: 'secret' }
    const token = await authService.linkGoogleAccount(payload)
    expect(token).toBe('linked-jwt')
    expect(mockPost).toHaveBeenCalledWith('/auth/google/link', payload)
  })

  it('unlinkGoogleAccount deletes the google link', async () => {
    mockDelete.mockResolvedValueOnce({})
    await authService.unlinkGoogleAccount()
    expect(mockDelete).toHaveBeenCalledWith('/auth/google/link')
  })
})
