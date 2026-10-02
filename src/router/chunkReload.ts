import type { Router } from 'vue-router'

// Vite fingerprints every lazy-loaded chunk with a content hash that
// changes on each build. A tab left open across a deployment still holds
// the previous index.html, so navigating to a not-yet-loaded route there
// requests chunk files the current server no longer has - browsers report
// that failure with one of these messages (wording differs per engine).
const CHUNK_LOAD_ERROR_PATTERN =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload css/i

// Guards against reloading forever if a chunk load fails for some other,
// persistent reason - cleared on the next successful navigation.
const CHUNK_RELOAD_FLAG = 'chunk-reload-attempted'

export function isChunkLoadError(message: string): boolean {
  return CHUNK_LOAD_ERROR_PATTERN.test(message)
}

// Recovers from stale chunk references by doing one full page load of the
// route the user actually wanted, which fetches the current index.html.
export function registerChunkReload(router: Router): void {
  // Cancelled or duplicated navigations also reach afterEach (with a
  // failure); only a real, completed navigation proves chunks load again.
  router.afterEach((_to, _from, failure) => {
    if (failure) return
    window.sessionStorage.removeItem(CHUNK_RELOAD_FLAG)
  })

  router.onError((error: unknown, to) => {
    const message = error instanceof Error ? error.message : String(error)
    if (!isChunkLoadError(message)) return
    if (window.sessionStorage.getItem(CHUNK_RELOAD_FLAG)) return

    window.sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1')
    window.location.href = to.fullPath
  })
}
