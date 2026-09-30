import { ref } from 'vue'
import type { Ref } from 'vue'
import type { PaginatedTransactions } from '@/types/p4x'

// Loads one page of a paginated transaction list for the current selection
// (a month, a partner, a filter or a category).
//
// - The previous result is dropped before every load, so rows of the former
//   selection are never shown under the heading of the new one, not even when
//   the new request fails.
// - Only the newest request may write the state: a slower, older response that
//   arrives late is ignored instead of overwriting the newer one.
// - A failed request sets `loadFailed` instead of rejecting, so callers can
//   render a retry state and no rejection ever goes unhandled.
// - `reload` repeats the page the server reported for the shown result, or the
//   last requested page when there is no result (after a failure).
export function usePaginatedTransactions<Selection>(
  selection: Readonly<Ref<Selection | null>>,
  fetchPage: (selection: Selection, page: number) => Promise<{ data: PaginatedTransactions }>,
) {
  const result = ref<PaginatedTransactions | null>(null)
  const loading = ref(false)
  const loadFailed = ref(false)
  let latestRequest = 0
  let requestedPage = 1

  const load = async (page = 1): Promise<void> => {
    const current = selection.value
    if (current === null) return

    const request = ++latestRequest
    requestedPage = page
    result.value = null
    loadFailed.value = false
    loading.value = true
    try {
      const response = await fetchPage(current, page)
      if (request === latestRequest) result.value = response.data
    } catch {
      if (request === latestRequest) loadFailed.value = true
    } finally {
      if (request === latestRequest) loading.value = false
    }
  }

  const reload = (): Promise<void> => load(result.value?.page ?? requestedPage)

  return { result, loading, loadFailed, load, reload }
}
