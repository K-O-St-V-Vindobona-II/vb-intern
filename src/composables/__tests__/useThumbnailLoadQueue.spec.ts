import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useThumbnailLoadQueue } from '@/composables/useThumbnailLoadQueue'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('useThumbnailLoadQueue', () => {
  it('runs up to 4 tasks concurrently and queues the rest until they resolve', async () => {
    const { schedule } = useThumbnailLoadQueue()
    const starts: number[] = []
    const deferreds = Array.from({ length: 6 }, () => deferred<number>())

    const results = deferreds.map((d, i) =>
      schedule(() => {
        starts.push(i)
        return d.promise
      }),
    )

    // schedule() runs the first MAX_CONCURRENT tasks synchronously.
    expect(starts).toEqual([0, 1, 2, 3])

    deferreds[0]!.resolve(0)
    await flushPromises()
    expect(starts).toEqual([0, 1, 2, 3, 4])

    deferreds[1]!.resolve(1)
    await flushPromises()
    expect(starts).toEqual([0, 1, 2, 3, 4, 5])

    // Drain the rest so module-level state is clean for the next test.
    deferreds[2]!.resolve(2)
    deferreds[3]!.resolve(3)
    deferreds[4]!.resolve(4)
    deferreds[5]!.resolve(5)
    await Promise.all(results)
  })

  it('resolves with the task result', async () => {
    const { schedule } = useThumbnailLoadQueue()
    await expect(schedule(() => Promise.resolve('thumb-url'))).resolves.toBe('thumb-url')
  })

  it('rejects when the task rejects, without blocking later tasks', async () => {
    const { schedule } = useThumbnailLoadQueue()
    await expect(schedule(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    await expect(schedule(() => Promise.resolve('ok'))).resolves.toBe('ok')
  })

  it('runs many tasks to completion without leaking concurrency state', async () => {
    const { schedule } = useThumbnailLoadQueue()
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => schedule(() => Promise.resolve(i))),
    )
    expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i))
  })
})
