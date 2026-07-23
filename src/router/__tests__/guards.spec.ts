import { describe, it, expect, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import {
  ensureSessionRestored,
  ensureUserLoaded,
  checkAuthRequirement,
  checkPermissions,
  type AuthStore,
} from '../guards'
import type { User } from '@/types/member'

function buildAuthStore(overrides: Partial<AuthStore> = {}): AuthStore {
  return {
    token: null,
    user: null,
    isRestoringSession: false,
    restoreSession: vi.fn().mockResolvedValue(true),
    fetchUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AuthStore
}

function buildRoute(overrides: Partial<RouteLocationNormalized> = {}): RouteLocationNormalized {
  return {
    name: 'some-route',
    fullPath: '/some-route',
    matched: [],
    meta: {},
    ...overrides,
  } as unknown as RouteLocationNormalized
}

function buildUser(permissions: string[] = []): User {
  return {
    id: 1,
    cn: 'Max Mustermann',
    default_image: null,
    org_id: 'vbw',
    auth_locked: false,
    permissions,
    google_linked: false,
    chroniclemail: false,
    session_idle_timeout: 1800,
  }
}

describe('ensureSessionRestored', () => {
  it('restores the session when unauthenticated and the route requires auth', async () => {
    const authStore = buildAuthStore()
    const to = buildRoute({ matched: [{ meta: { requiresAuth: true } } as never] })

    const result = await ensureSessionRestored(authStore, to)

    expect(authStore.restoreSession).toHaveBeenCalledOnce()
    expect(result).toBeNull()
  })

  it('redirects to login when session restoration fails', async () => {
    const authStore = buildAuthStore({ restoreSession: vi.fn().mockResolvedValue(false) })
    const to = buildRoute({
      fullPath: '/p4x',
      matched: [{ meta: { requiresAuth: true } } as never],
    })

    const result = await ensureSessionRestored(authStore, to)

    expect(result).toEqual({ name: 'login', query: { redirect: '/p4x' } })
  })

  it('does nothing when a token already exists', async () => {
    const authStore = buildAuthStore({ token: 'existing-token' })
    const to = buildRoute({ matched: [{ meta: { requiresAuth: true } } as never] })

    const result = await ensureSessionRestored(authStore, to)

    expect(authStore.restoreSession).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('does nothing while a restoration is already in progress', async () => {
    const authStore = buildAuthStore({ isRestoringSession: true })
    const to = buildRoute({ matched: [{ meta: { requiresAuth: true } } as never] })

    const result = await ensureSessionRestored(authStore, to)

    expect(authStore.restoreSession).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('does nothing when the route does not require auth', async () => {
    const authStore = buildAuthStore()
    const to = buildRoute({ matched: [{ meta: {} } as never] })

    const result = await ensureSessionRestored(authStore, to)

    expect(authStore.restoreSession).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })
})

describe('ensureUserLoaded', () => {
  it('fetches the user when a token exists but no user is loaded', async () => {
    const authStore = buildAuthStore({ token: 'a-token' })
    const to = buildRoute()

    const result = await ensureUserLoaded(authStore, to)

    expect(authStore.fetchUser).toHaveBeenCalledOnce()
    expect(result).toBeNull()
  })

  it('redirects to login when fetchUser throws and the target is not login', async () => {
    const authStore = buildAuthStore({
      token: 'a-token',
      fetchUser: vi.fn().mockRejectedValue(new Error('boom')),
    })
    const to = buildRoute({ name: 'p4x-dashboard', fullPath: '/p4x' })

    const result = await ensureUserLoaded(authStore, to)

    expect(result).toEqual({ name: 'login', query: { redirect: '/p4x' } })
  })

  it('does not redirect when fetchUser throws but the target is already login', async () => {
    const authStore = buildAuthStore({
      token: 'a-token',
      fetchUser: vi.fn().mockRejectedValue(new Error('boom')),
    })
    const to = buildRoute({ name: 'login' })

    const result = await ensureUserLoaded(authStore, to)

    expect(result).toBeNull()
  })

  it('does nothing when there is no token', async () => {
    const authStore = buildAuthStore()
    const to = buildRoute()

    const result = await ensureUserLoaded(authStore, to)

    expect(authStore.fetchUser).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('does nothing when the user is already loaded', async () => {
    const authStore = buildAuthStore({ token: 'a-token', user: buildUser() })
    const to = buildRoute()

    const result = await ensureUserLoaded(authStore, to)

    expect(authStore.fetchUser).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })
})

describe('checkAuthRequirement', () => {
  it('redirects to login when the route requires auth and the user is not authenticated', () => {
    const authStore = buildAuthStore()
    const to = buildRoute({
      fullPath: '/p4x',
      matched: [{ meta: { requiresAuth: true } } as never],
    })

    expect(checkAuthRequirement(authStore, to)).toEqual({
      name: 'login',
      query: { redirect: '/p4x' },
    })
  })

  it('allows access when the route requires auth and the user is authenticated', () => {
    const authStore = buildAuthStore({ token: 'a-token' })
    const to = buildRoute({ matched: [{ meta: { requiresAuth: true } } as never] })

    expect(checkAuthRequirement(authStore, to)).toBeNull()
  })

  it('redirects to home when the route requires guest and the user is authenticated', () => {
    const authStore = buildAuthStore({ token: 'a-token' })
    const to = buildRoute({ matched: [{ meta: { requiresGuest: true } } as never] })

    expect(checkAuthRequirement(authStore, to)).toEqual({ name: 'home' })
  })

  it('allows access when the route requires guest and the user is not authenticated', () => {
    const authStore = buildAuthStore()
    const to = buildRoute({ matched: [{ meta: { requiresGuest: true } } as never] })

    expect(checkAuthRequirement(authStore, to)).toBeNull()
  })

  it('allows access when the route has no auth-related meta', () => {
    const authStore = buildAuthStore()
    const to = buildRoute({ matched: [{ meta: {} } as never] })

    expect(checkAuthRequirement(authStore, to)).toBeNull()
  })
})

describe('checkPermissions', () => {
  it('allows access when the user has one of the required permissions', () => {
    const authStore = buildAuthStore({ user: buildUser(['p4xAdmin']) })
    const to = buildRoute({ meta: { requiredPermissions: ['p4xAdmin', 'p4xView'] } })

    expect(checkPermissions(authStore, to)).toBeNull()
  })

  it('redirects to unauthorized when the user has none of the required permissions', () => {
    const authStore = buildAuthStore({ user: buildUser(['p4xView']) })
    const to = buildRoute({ meta: { requiredPermissions: ['p4xAdmin'] } })

    expect(checkPermissions(authStore, to)).toEqual({ name: 'unauthorized' })
  })

  it('redirects to unauthorized when there is no user at all', () => {
    const authStore = buildAuthStore()
    const to = buildRoute({ meta: { requiredPermissions: ['p4xAdmin'] } })

    expect(checkPermissions(authStore, to)).toEqual({ name: 'unauthorized' })
  })

  it('allows access when the route has no required permissions', () => {
    const authStore = buildAuthStore()
    const to = buildRoute({ meta: {} })

    expect(checkPermissions(authStore, to)).toBeNull()
  })
})
