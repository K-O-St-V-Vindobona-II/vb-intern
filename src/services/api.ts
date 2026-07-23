import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useLoadingStore } from '@/stores/loading'
import router from '@/router'
import { apiBaseUrl } from '@/runtimeConfig'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors axios's own untyped interceptor config shape, plus the ad-hoc _retry flag this interceptor stores on it
async function refreshTokenAndRetry(originalRequest: any, error: unknown) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see refreshTokenAndRetry
function queueForRefresh(originalRequest: any) {
  return new Promise((resolve) => {
    refreshSubscribers.push((newToken: string) => {
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      resolve(api(originalRequest))
    })
  })
}

async function handleForbidden(error: unknown) {
  const authStore = useAuthStore()
  await authStore.fetchUser()
  router.push({ name: 'home' }).catch(() => {})
  return Promise.reject(error)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see refreshTokenAndRetry
function handleNetworkErrorIfAuthenticated(error: any) {
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
  async (error) => {
    useLoadingStore().stopLoading()

    const originalRequest = error.config
    const status = error.response?.status

    if (status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/refresh')) {
        return handleRefreshEndpointUnauthorized(error)
      }

      originalRequest._retry = true

      if (!isRefreshing) {
        return refreshTokenAndRetry(originalRequest, error)
      }
      return queueForRefresh(originalRequest)
    }

    if (status === 403) {
      return handleForbidden(error)
    }

    handleNetworkErrorIfAuthenticated(error)

    return Promise.reject(error)
  },
)

export default api
