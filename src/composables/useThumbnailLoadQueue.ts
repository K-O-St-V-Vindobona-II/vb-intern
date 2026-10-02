// Global concurrency limit for thumbnail loads (FileIcon.vue's
// IntersectionObserver fires one load per row as it scrolls into view,
// completely uncoordinated across rows). A directory listing — active or
// trashed — can contain hundreds of image rows, and each load holds a
// pooled backend DB connection open for the full S3 round-trip (see
// app/services/archive_service.py). Without a cap, a burst of simultaneous
// loads can exhaust that pool (incident 2026-08-01). This queue is
// module-level state, not per-component: every FileIcon instance across
// the whole app shares the same limit.

const MAX_CONCURRENT = 4

let active = 0
const pending: Array<() => void> = []

// The task's type promises a Promise, but a task that throws synchronously would
// escape the queue with its slot already counted: `active` would never drop
// again and the queue, shared by the whole app, would stall for good. The task
// still starts immediately; a synchronous throw becomes an ordinary rejection.
function startTask<T>(task: () => Promise<T>): Promise<T> {
  try {
    return task()
  } catch (error) {
    return Promise.reject(error)
  }
}

function runNext(): void {
  if (active >= MAX_CONCURRENT) return
  const next = pending.shift()
  if (!next) return
  next()
}

export function useThumbnailLoadQueue() {
  function schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      pending.push(() => {
        active++
        startTask(task)
          .then(resolve, reject)
          .finally(() => {
            active--
            runNext()
          })
      })
      runNext()
    })
  }

  return { schedule }
}
