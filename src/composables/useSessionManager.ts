import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/services/api'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const
const EXPIRY_CHECK_INTERVAL_MS = 60_000
const ACTIVITY_DEBOUNCE_MS = 10_000
const PROACTIVE_REFRESH_BUFFER_S = 120

export function useSessionManager() {
  const router = useRouter()
  const authStore = useAuthStore()

  const loginTime = ref('')

  let expiryCheckTimer: ReturnType<typeof setInterval> | null = null
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let lastActivityTs = 0

  const parseTokenPayload = (): { iat?: number; exp?: number } => {
    const tokenValue = authStore.token
    if (!tokenValue) return {}
    try {
      return JSON.parse(atob(tokenValue.split('.')[1] ?? ''))
    } catch {
      return {}
    }
  }

  const performLogout = async () => {
    stopAll()
    await authStore.logout()
    router.push({ name: 'login' })
  }

  const proactiveRefresh = async () => {
    try {
      const { data } = await api.post('/auth/refresh')
      authStore.setToken(data.access_token)
      scheduleProactiveRefresh()
    } catch {
      performLogout()
    }
  }

  const scheduleProactiveRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer)
    const { exp } = parseTokenPayload()
    if (!exp) return
    const refreshInMs = Math.max(
      0,
      (exp - Math.floor(Date.now() / 1000) - PROACTIVE_REFRESH_BUFFER_S) * 1000,
    )
    refreshTimer = setTimeout(proactiveRefresh, refreshInMs)
  }

  // Backstop for scheduleProactiveRefresh's own timer: a backgrounded/throttled
  // tab can delay that timeout past the token's actual expiry, so this periodic
  // check catches it and refreshes anyway instead of waiting for a 401.
  const checkExpiryFallback = () => {
    const { exp } = parseTokenPayload()
    if (!exp) return
    const remaining = exp - Math.floor(Date.now() / 1000)
    if (remaining <= 0) proactiveRefresh()
  }

  const startIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer)
    const timeoutMs = (authStore.user?.session_idle_timeout ?? 30) * 60_000
    idleTimer = setTimeout(() => performLogout(), timeoutMs)
  }

  const onActivity = () => {
    const now = Date.now()
    if (now - lastActivityTs < ACTIVITY_DEBOUNCE_MS) return
    lastActivityTs = now
    startIdleTimer()
  }

  const stopAll = () => {
    if (expiryCheckTimer) {
      clearInterval(expiryCheckTimer)
      expiryCheckTimer = null
    }
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
    for (const event of ACTIVITY_EVENTS) {
      document.removeEventListener(event, onActivity)
    }
  }

  onMounted(() => {
    const { iat } = parseTokenPayload()
    loginTime.value = iat
      ? new Date(iat * 1000).toLocaleString('de-AT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''

    expiryCheckTimer = setInterval(checkExpiryFallback, EXPIRY_CHECK_INTERVAL_MS)

    scheduleProactiveRefresh()
    startIdleTimer()

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, onActivity, { passive: true })
    }
  })

  onUnmounted(stopAll)

  return { loginTime }
}
