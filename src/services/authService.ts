import api from './api'

export default {
  async login(formData: URLSearchParams): Promise<string> {
    const response = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return response.data.access_token
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },

  /**
   * Step 1 of the password reset flow. Requests the email link.
   * @param email Target user's email address
   */
  async requestPasswordReset(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email })
  },

  /**
   * Step 2 of the password reset flow. Commits the new password.
   * @param payload Contains email, token, and the new password
   */
  async executePasswordReset(payload: Record<string, string>): Promise<void> {
    await api.post('/auth/reset-password', payload)
  },

  /**
   * Performs authentication via a Google JWT credential.
   * @param credential The ID token provided by Google
   * @returns JWT access token from our backend
   */
  async loginWithGoogle(credential: string): Promise<string> {
    const response = await api.post('/auth/google', { credential })
    return response.data.access_token
  },

  /**
   * Binds a Google account to a local account.
   */
  async linkGoogleAccount(payload: {
    credential: string
    email: string
    password: string
  }): Promise<string> {
    const response = await api.post('/auth/google/link', payload)
    return response.data.access_token
  },

  /**
   * Removes the Google binding from the current user account.
   */
  async unlinkGoogleAccount(): Promise<void> {
    await api.delete('/auth/google/link')
  },
}
