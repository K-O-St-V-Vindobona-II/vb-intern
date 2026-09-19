import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryHistory,
  createRouter,
  type NavigationFailure,
  type RouteLocationNormalized,
  type Router,
} from 'vue-router'
import { isChunkLoadError, registerChunkReload } from '../chunkReload'

// The sessionStorage key is part of the observable behaviour (it survives the
// full page load that the reload triggers), so the tests assert on it directly.
const CHUNK_RELOAD_FLAG = 'chunk-reload-attempted'
const CHUNK_ERROR_MESSAGE =
  'Failed to fetch dynamically imported module: https://intern.vindobona2.at/assets/P4xDashboardView-Bx3k9aQz.js'

type AfterEachHandler = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  failure?: NavigationFailure | void,
) => void
type ErrorHandler = (error: unknown, to: RouteLocationNormalized) => void

function buildRoute(fullPath = '/some-route'): RouteLocationNormalized {
  return { fullPath } as unknown as RouteLocationNormalized
}

function requireHandler<T>(handler: T | undefined): T {
  if (!handler) throw new Error('Handler was not registered on the router')
  return handler
}

// Router stub that records the handlers registered by registerChunkReload so
// each of them can be invoked individually, like the real router would.
function buildRouterStub() {
  let afterEachHandler: AfterEachHandler | undefined
  let errorHandler: ErrorHandler | undefined
  const router = {
    afterEach: vi.fn((handler: AfterEachHandler) => {
      afterEachHandler = handler
    }),
    onError: vi.fn((handler: ErrorHandler) => {
      errorHandler = handler
    }),
  }

  registerChunkReload(router as unknown as Router)

  return {
    router,
    completeNavigation: (failure?: NavigationFailure) =>
      requireHandler(afterEachHandler)(buildRoute(), buildRoute(), failure),
    failNavigation: (error: unknown, to: RouteLocationNormalized = buildRoute()) =>
      requireHandler(errorHandler)(error, to),
  }
}

describe('isChunkLoadError', () => {
  it.each([
    ['Chromium', CHUNK_ERROR_MESSAGE],
    [
      'Firefox',
      'error loading dynamically imported module: https://intern.vindobona2.at/assets/X.js',
    ],
    ['Safari', 'Importing a module script failed.'],
    ['Vite CSS preload', 'Unable to preload CSS for /assets/X-abc123.css'],
  ])('recognises the %s wording', (_engine, message) => {
    expect(isChunkLoadError(message)).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(isChunkLoadError('FAILED TO FETCH DYNAMICALLY IMPORTED MODULE')).toBe(true)
  })

  it.each([
    'Network Error',
    'Failed to fetch',
    "Cannot read properties of undefined (reading 'permissions')",
    '',
  ])('rejects the unrelated error "%s"', (message) => {
    expect(isChunkLoadError(message)).toBe(false)
  })
})

describe('registerChunkReload', () => {
  const originalLocation = Object.getOwnPropertyDescriptor(window, 'location')

  beforeEach(() => {
    window.sessionStorage.clear()
    // jsdom does not implement navigation, so assigning href on the real
    // location would only log "Not implemented: navigation".
    Object.defineProperty(window, 'location', {
      value: { href: '/current' },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    window.sessionStorage.clear()
    if (originalLocation) Object.defineProperty(window, 'location', originalLocation)
  })

  it('registers one afterEach and one onError handler', () => {
    const { router } = buildRouterStub()

    expect(router.afterEach).toHaveBeenCalledOnce()
    expect(router.onError).toHaveBeenCalledOnce()
  })

  it('reloads to the intended target route and sets the guard flag on a chunk error', () => {
    const { failNavigation } = buildRouterStub()

    failNavigation(new Error(CHUNK_ERROR_MESSAGE), buildRoute('/p4x/accounts?page=2'))

    expect(window.location.href).toBe('/p4x/accounts?page=2')
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_FLAG)).toBe('1')
  })

  it('also recognises a chunk error that is not an Error instance', () => {
    const { failNavigation } = buildRouterStub()

    failNavigation(CHUNK_ERROR_MESSAGE, buildRoute('/p4x'))

    expect(window.location.href).toBe('/p4x')
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_FLAG)).toBe('1')
  })

  it('ignores errors that are not chunk load failures', () => {
    const { failNavigation } = buildRouterStub()

    failNavigation(new Error('Network Error'), buildRoute('/p4x'))

    expect(window.location.href).toBe('/current')
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_FLAG)).toBeNull()
  })

  it('does not reload a second time when the chunk error persists', () => {
    const { failNavigation } = buildRouterStub()

    failNavigation(new Error(CHUNK_ERROR_MESSAGE), buildRoute('/p4x'))
    failNavigation(new Error(CHUNK_ERROR_MESSAGE), buildRoute('/archive'))

    expect(window.location.href).toBe('/p4x')
  })

  it('resets the guard on the next successful navigation so a later deploy can recover', () => {
    const { failNavigation, completeNavigation } = buildRouterStub()
    failNavigation(new Error(CHUNK_ERROR_MESSAGE), buildRoute('/p4x'))

    completeNavigation()
    failNavigation(new Error(CHUNK_ERROR_MESSAGE), buildRoute('/archive'))

    expect(window.location.href).toBe('/archive')
  })

  it('keeps the guard when the navigation ended with a failure', () => {
    const { failNavigation, completeNavigation } = buildRouterStub()
    failNavigation(new Error(CHUNK_ERROR_MESSAGE), buildRoute('/p4x'))

    completeNavigation({ type: 4 } as unknown as NavigationFailure)
    failNavigation(new Error(CHUNK_ERROR_MESSAGE), buildRoute('/archive'))

    expect(window.sessionStorage.getItem(CHUNK_RELOAD_FLAG)).toBe('1')
    expect(window.location.href).toBe('/p4x')
  })

  // Guards the assumptions the stub-based tests cannot: the real router passes
  // the target route to onError and does not run afterEach for a failed chunk
  // load (which would otherwise clear the guard right after it was set).
  it('works end to end with a real router and a lazy route whose chunk is gone', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { render: () => null } },
        { path: '/lazy', component: () => Promise.reject(new Error(CHUNK_ERROR_MESSAGE)) },
      ],
    })
    registerChunkReload(router)
    await router.push('/')

    await expect(router.push('/lazy?tab=2')).rejects.toThrow(CHUNK_ERROR_MESSAGE)
    expect(window.location.href).toBe('/lazy?tab=2')
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_FLAG)).toBe('1')

    await expect(router.push('/lazy?tab=3')).rejects.toThrow(CHUNK_ERROR_MESSAGE)
    expect(window.location.href).toBe('/lazy?tab=2')
  })
})
