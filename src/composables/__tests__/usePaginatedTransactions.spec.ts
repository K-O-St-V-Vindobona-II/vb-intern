import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { usePaginatedTransactions } from '@/composables/usePaginatedTransactions'
import type { PaginatedTransactions } from '@/types/p4x'

type PageResponse = { data: PaginatedTransactions }

function page(total: number, pageNumber = 1): PageResponse {
  return { data: { items: [], total, page: pageNumber, per_page: 100 } }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('usePaginatedTransactions', () => {
  it('passes the selection and the page to the fetcher and exposes the result', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page(7, 2))
    const { result, loading, loadFailed, load } = usePaginatedTransactions(
      ref('partner-uuid-1'),
      fetchPage,
    )

    const pending = load(2)
    expect(loading.value).toBe(true)
    await pending

    expect(fetchPage).toHaveBeenCalledWith('partner-uuid-1', 2)
    expect(result.value?.total).toBe(7)
    expect(loading.value).toBe(false)
    expect(loadFailed.value).toBe(false)
  })

  it('does nothing while nothing is selected', async () => {
    const fetchPage = vi.fn()
    const { result, loading, load } = usePaginatedTransactions(ref<string | null>(null), fetchPage)

    await load()

    expect(fetchPage).not.toHaveBeenCalled()
    expect(result.value).toBeNull()
    expect(loading.value).toBe(false)
  })

  it('drops the previous result as soon as a new load starts', async () => {
    const second = deferred<PageResponse>()
    const fetchPage = vi.fn().mockResolvedValueOnce(page(1)).mockReturnValueOnce(second.promise)
    const { result, load } = usePaginatedTransactions(ref('a'), fetchPage)
    await load()
    expect(result.value?.total).toBe(1)

    const pending = load()

    expect(result.value).toBeNull()
    second.resolve(page(2))
    await pending
    expect(result.value?.total).toBe(2)
  })

  it('reports a failed load without rejecting and without keeping the previous result', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(1))
      .mockRejectedValueOnce(new Error('boom'))
    const { result, loading, loadFailed, load } = usePaginatedTransactions(ref('a'), fetchPage)
    await load()

    await expect(load()).resolves.toBeUndefined()

    expect(loadFailed.value).toBe(true)
    expect(result.value).toBeNull()
    expect(loading.value).toBe(false)
  })

  it('clears the failure flag when the next load starts', async () => {
    const retry = deferred<PageResponse>()
    const fetchPage = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockReturnValueOnce(retry.promise)
    const { loadFailed, load } = usePaginatedTransactions(ref('a'), fetchPage)
    await load()
    expect(loadFailed.value).toBe(true)

    const pending = load()

    expect(loadFailed.value).toBe(false)
    retry.resolve(page(1))
    await pending
  })

  it('ignores a slower, older response that arrives after a newer one', async () => {
    const older = deferred<PageResponse>()
    const newer = deferred<PageResponse>()
    const fetchPage = vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const { result, loading, load } = usePaginatedTransactions(ref('a'), fetchPage)

    const olderLoad = load()
    const newerLoad = load()
    newer.resolve(page(2))
    await newerLoad
    older.resolve(page(1))
    await olderLoad

    expect(result.value?.total).toBe(2)
    expect(loading.value).toBe(false)
  })

  it('keeps the loading flag on until the newest request has finished', async () => {
    const older = deferred<PageResponse>()
    const newer = deferred<PageResponse>()
    const fetchPage = vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const { loading, load } = usePaginatedTransactions(ref('a'), fetchPage)

    load()
    const newerLoad = load()
    older.resolve(page(1))
    await flushPromises()
    expect(loading.value).toBe(true)

    newer.resolve(page(2))
    await newerLoad
    expect(loading.value).toBe(false)
  })

  it('ignores the failure of an older request once a newer one is running', async () => {
    const older = deferred<PageResponse>()
    const newer = deferred<PageResponse>()
    const fetchPage = vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const { result, loadFailed, load } = usePaginatedTransactions(ref('a'), fetchPage)

    const olderLoad = load()
    const newerLoad = load()
    older.reject(new Error('boom'))
    await olderLoad
    expect(loadFailed.value).toBe(false)

    newer.resolve(page(2))
    await newerLoad
    expect(result.value?.total).toBe(2)
  })

  it('reload repeats the last requested page, also after a failure', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(9, 3))
      .mockRejectedValueOnce(new Error('boom'))
    const { loadFailed, load, reload } = usePaginatedTransactions(ref('a'), fetchPage)
    await load(3)
    await load(4)
    expect(loadFailed.value).toBe(true)

    fetchPage.mockResolvedValueOnce(page(9, 4))
    await reload()

    expect(fetchPage).toHaveBeenLastCalledWith('a', 4)
    expect(loadFailed.value).toBe(false)
  })

  it('reload repeats the page the server reported for the shown result', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page(9, 3))
    const { load, reload } = usePaginatedTransactions(ref('a'), fetchPage)
    await load(1)

    await reload()

    expect(fetchPage).toHaveBeenLastCalledWith('a', 3)
  })

  it('reads the current selection at load time', async () => {
    const selection = ref('a')
    const fetchPage = vi.fn().mockResolvedValue(page(1))
    const { load } = usePaginatedTransactions(selection, fetchPage)

    selection.value = 'b'
    await load()

    expect(fetchPage).toHaveBeenCalledWith('b', 1)
  })
})
