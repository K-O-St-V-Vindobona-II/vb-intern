import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useLoadingStore } from '@/stores/loading'
import router from '@/router'
import { apiBaseUrl } from '@/runtimeConfig'

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

let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

function onRefreshComplete(newToken: string) {
  refreshSubscribers.forEach((cb) => cb(newToken))
  refreshSubscribers = []
}

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

async function refreshTokenAndRetry(originalRequest: InternalAxiosRequestConfig, error: unknown) {
  isRefreshing = true
  try {
    const { data } = await api.post('/auth/refresh')
    const authStore = useAuthStore()
    authStore.setToken(data.access_token)
    isRefreshing = false
    onRefreshComplete(data.access_token)
    originalRequest.headers.Authorization = `Bearer ${data.access_token}`
    return api(originalRequest)
  } catch {
    isRefreshing = false
    refreshSubscribers = []
    const authStore = useAuthStore()
    authStore.clearAuth()
    redirectToLoginIfNeeded()
    return Promise.reject(error)
  }
}

function queueForRefresh(originalRequest: InternalAxiosRequestConfig) {
  return new Promise((resolve) => {
    refreshSubscribers.push((newToken: string) => {
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      resolve(api(originalRequest))
    })
  })
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

  if (!isRefreshing) {
    return refreshTokenAndRetry(originalRequest, error)
  }
  return queueForRefresh(originalRequest)
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
