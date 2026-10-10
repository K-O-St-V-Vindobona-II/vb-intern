import api from '@/services/api'

// The server rotates the refresh secret on every call and ends a session when
// a secret is presented a second time. So exactly one refresh request may run
// at a time: inside this tab all callers (a 401 response, the proactive timer,
// the session restore) share one request, and across the tabs of the browser
// the Web Locks API lets them take turns. The lock is held for as long as the
// request runs, hence the timeout.
export const REFRESH_LOCK_NAME = 'vb-intern-auth-refresh'
export const REFRESH_TIMEOUT_MS = 15_000

let inFlight: Promise<string> | null = null

async function requestNewAccessToken(): Promise<string> {
  const { data } = await api.post<{ access_token: string }>('/auth/refresh', undefined, {
    timeout: REFRESH_TIMEOUT_MS,
  })
  return data.access_token
}

// Runs the task alone among the tabs of this browser. A browser that cannot
// grant the lock (no Web Locks API, or an environment that refuses it) runs
// the task without it; a failure of the task itself is never retried.
async function runAloneInThisBrowser(task: () => Promise<string>): Promise<string> {
  const locks: LockManager | undefined =
    typeof navigator === 'undefined' ? undefined : navigator.locks
  if (!locks) return task()

  let started = false
  try {
    return await locks.request(REFRESH_LOCK_NAME, () => {
      started = true
      return task()
    })
  } catch (error) {
    if (started) throw error
    return task()
  }
}

/** Fetches a new access token; concurrent callers share one request. */
export function refreshAccessToken(): Promise<string> {
  inFlight ??= runAloneInThisBrowser(requestNewAccessToken).finally(() => {
    inFlight = null
  })
  return inFlight
}
