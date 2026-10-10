import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useLoadingStore } from '@/stores/loading'
import router from '@/router'
import { apiBaseUrl } from '@/runtimeConfig'
import { refreshAccessToken } from '@/services/sessionRefresh'

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

const api = axios.create({
  baseURL: apiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

function redirectToLoginIfNeeded() {
  if (router.currentRoute.value.name !== 'login') {
    router
      .push({
        name: 'login',
        query: { redirect: router.currentRoute.value.fullPath },
      })
      .catch(() => {})
  }
}

async function handleRefreshEndpointUnauthorized(error: unknown) {
  const authStore = useAuthStore()
  authStore.clearAuth()
  redirectToLoginIfNeeded()
  return Promise.reject(error)
}

// Every request that gets a 401 while a refresh runs waits for that same refresh
// (see refreshAccessToken) and is retried with the new token, or fails with its
// own error when the refresh fails.
async function refreshTokenAndRetry(originalRequest: InternalAxiosRequestConfig, error: unknown) {
  try {
    const accessToken = await refreshAccessToken()
    useAuthStore().setToken(accessToken)
    originalRequest.headers.Authorization = `Bearer ${accessToken}`
    return api(originalRequest)
  } catch {
    const authStore = useAuthStore()
    authStore.clearAuth()
    redirectToLoginIfNeeded()
    return Promise.reject(error)
  }
}

// Centralizes the 401 branch so the response interceptor below stays a flat
// dispatch table instead of nesting this logic's own conditions inline.
async function handleUnauthorized(
  originalRequest: InternalAxiosRequestConfig | undefined,
  error: AxiosError,
) {
  if (!originalRequest || originalRequest._retry) {
    return Promise.reject(error)
  }

  if (originalRequest.url?.includes('/auth/refresh')) {
    return handleRefreshEndpointUnauthorized(error)
  }

  originalRequest._retry = true

  return refreshTokenAndRetry(originalRequest, error)
}

// Refreshes the cached permission set in case it was revoked server-side,
// but leaves navigation to the calling view — a 403 is often a request-scoped
// business rule (e.g. cross-org write) rather than a stale global permission,
// and checkPermissions() in router/guards.ts already re-validates on the next
// navigation regardless.
async function handleForbidden(error: unknown) {
  const authStore = useAuthStore()
  await authStore.fetchUser()
  return Promise.reject(error)
}

function handleNetworkErrorIfAuthenticated(error: AxiosError) {
  const isNetworkError = !error.response && error.request
  if (!isNetworkError) return

  const authStore = useAuthStore()
  if (authStore.token) {
    authStore.clearAuth()
    redirectToLoginIfNeeded()
  }
}

api.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`
  }
  useLoadingStore().startLoading()
  return config
})

api.interceptors.response.use(
  (response) => {
    useLoadingStore().stopLoading()
    return response
  },
  async (error: AxiosError) => {
    useLoadingStore().stopLoading()

    const status = error.response?.status

    if (status === 401) {
      return handleUnauthorized(error.config, error)
    }

    if (status === 403) {
      return handleForbidden(error)
    }

    handleNetworkErrorIfAuthenticated(error)

    return Promise.reject(error)
  },
)

export default api
