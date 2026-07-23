import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import type { useAuthStore } from '@/stores/auth'

export type AuthStore = ReturnType<typeof useAuthStore>

// Restores the session from a refresh token when a protected route is
// entered without one already loaded in memory (e.g. a hard page reload).
export async function ensureSessionRestored(
  authStore: AuthStore,
  to: RouteLocationNormalized,
): Promise<RouteLocationRaw | null> {
  if (
    !authStore.token &&
    !authStore.isRestoringSession &&
    to.matched.some((r) => r.meta['requiresAuth'])
  ) {
    const restored = await authStore.restoreSession()
    if (!restored) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }
  return null
}

// Hydrates the user profile once a token exists but no user is loaded yet.
export async function ensureUserLoaded(
  authStore: AuthStore,
  to: RouteLocationNormalized,
): Promise<RouteLocationRaw | null> {
  if (authStore.token && !authStore.user) {
    try {
      await authStore.fetchUser()
    } catch {
      if (to.name !== 'login') {
        return { name: 'login', query: { redirect: to.fullPath } }
      }
    }
  }
  return null
}

// Enforces requiresAuth/requiresGuest route meta.
export function checkAuthRequirement(
  authStore: AuthStore,
  to: RouteLocationNormalized,
): RouteLocationRaw | null {
  const isAuthenticated = !!authStore.token

  if (to.matched.some((r) => r.meta['requiresAuth']) && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.matched.some((r) => r.meta['requiresGuest']) && isAuthenticated) {
    return { name: 'home' }
  }
  return null
}

// Enforces requiredPermissions route meta.
export function checkPermissions(
  authStore: AuthStore,
  to: RouteLocationNormalized,
): RouteLocationRaw | null {
  if (to.meta['requiredPermissions']) {
    const required = to.meta['requiredPermissions'] as string[]
    const userPerms = authStore.user?.permissions || []
    const hasAccess = required.some((p) => userPerms.includes(p))
    if (!hasAccess) {
      return { name: 'unauthorized' }
    }
  }
  return null
}
