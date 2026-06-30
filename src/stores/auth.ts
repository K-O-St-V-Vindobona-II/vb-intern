import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@/types/member'
import authService from '@/services/authService'
import memberService from '@/services/memberService'
import api from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<User | null>(null)
  const isRestoringSession = ref(false)

  function setToken(newToken: string) {
    token.value = newToken
  }

  function clearAuth() {
    token.value = null
    user.value = null
  }

  async function fetchUser(): Promise<void> {
    if (!token.value) return
    try {
      const userData = await memberService.getCurrentUser()
      user.value = userData
    } catch {
      // eslint-disable-next-line no-console -- intentional error log, no error-tracking system in place yet
      console.error('Failed to fetch user profile.')
    }
  }

  async function restoreSession(): Promise<boolean> {
    isRestoringSession.value = true
    try {
      const { data } = await api.post('/auth/refresh')
      setToken(data.access_token)
      await fetchUser()
      return true
    } catch {
      clearAuth()
      return false
    } finally {
      isRestoringSession.value = false
    }
  }

  async function login(formData: URLSearchParams): Promise<void> {
    const accessToken = await authService.login(formData)
    setToken(accessToken)
    await fetchUser()
  }

  async function logout(): Promise<void> {
    try {
      await authService.logout()
    } catch {
      // eslint-disable-next-line no-console -- intentional warning log, no error-tracking system in place yet
      console.warn('Backend session could not be destroyed or already expired.')
    } finally {
      clearAuth()
    }
  }

  async function googleLogin(credential: string): Promise<void> {
    const accessToken = await authService.loginWithGoogle(credential)
    setToken(accessToken)
    await fetchUser()
  }

  async function linkGoogle(payload: {
    credential: string
    email: string
    password: string
  }): Promise<void> {
    const accessToken = await authService.linkGoogleAccount(payload)
    setToken(accessToken)
    await fetchUser()
  }

  async function unlinkGoogle(): Promise<void> {
    await authService.unlinkGoogleAccount()
    await fetchUser()
  }

  return {
    token,
    user,
    isRestoringSession,
    setToken,
    clearAuth,
    login,
    logout,
    fetchUser,
    restoreSession,
    googleLogin,
    linkGoogle,
    unlinkGoogle,
  }
})
