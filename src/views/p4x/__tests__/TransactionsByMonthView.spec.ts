import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, KeepAlive } from 'vue'
import type { VNode } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import TransactionsByMonthView from '../TransactionsByMonthView.vue'
import PrimeVue from 'primevue/config'
import type { P4xCategory, P4xTransaction, PaginatedTransactions } from '@/types/p4x'

const ACCOUNT_ID = '0198f2a4-7b1c-7a3e-8d21-5f6a9c1e2b34'

const mockAuthStore: { user: { permissions: string[] } | null } = { user: { permissions: [] } }
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

const mockGetTransactionsByMonth = vi.fn()
const mockGetDashboard = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getTransactionsByMonth: (...args: unknown[]) => mockGetTransactionsByMonth(...args),
    getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
  },
}))

const categories: P4xCategory[] = [
  {
    id: 'category-uuid-1',
    name: 'spende',
    label: 'Spende',
    background_color: '#fff',
    text_color: '#000',
    protected: false,
  },
]

function buildTx(overrides: Partial<P4xTransaction> = {}): P4xTransaction {
  return {
    id: '1',
    booking: '2026-06-01',
    valuation: '2026-06-01',
    iban: 'AT001234',
    amount: 10,
    subject: 'Spende',
    p4x_account_id: ACCOUNT_ID,
    p4x_account_cn: 'Kasse Wien',
    p4x_account_iban: 'AT00',
    comment: null,
    has_attachment: false,
    partner: null,
    delegating_partner: null,
    p4x_category_directs: [],
    p4x_category_filters: [],
    ...overrides,
  }
}

function buildResult(overrides: Partial<PaginatedTransactions> = {}): PaginatedTransactions {
  return {
    items: [buildTx()],
    total: 1,
    page: 1,
    per_page: 50,
    startbalance: 5,
    endbalance: 15,
    ...overrides,
  }
}

const stubs = {
  TransactionTable: {
    name: 'TransactionTable',
    template: '<div class="transaction-table-stub" />',
    props: ['transactions', 'categories', 'total', 'page', 'perPage', 'admin'],
    emits: ['pageChange', 'refresh'],
  },
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

// The view reads its month from the route and changes it through the router, so the
// tests run against a real (memory) router: a static route mock cannot notice a
// month change that loads twice.
async function mountAt(path: string, options: { keepAlive?: boolean } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/p4x', name: 'p4x-dashboard', component: { template: '<div />' } },
      {
        path: '/p4x/accounts/:accountId/transactions/by-month/:year/:month',
        name: 'p4x-transactions-month',
        component: TransactionsByMonthView,
      },
    ],
  })
  await router.push(path)
  await router.isReady()
  const root = defineComponent({
    setup: () => () =>
      h(
        RouterView,
        null,
        options.keepAlive
          ? {
              default: ({ Component }: { Component: VNode }) => h(KeepAlive, null, [h(Component)]),
            }
          : undefined,
      ),
  })
  const wrapper = mount(root, {
    global: { plugins: [PrimeVue, router], stubs },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

const JUNE = `/p4x/accounts/${ACCOUNT_ID}/transactions/by-month/2026/6`

async function pickMonth(wrapper: ReturnType<typeof mount>, date: Date) {
  const datePicker = wrapper.findComponent({ name: 'DatePicker' })
  await datePicker.vm.$emit('update:modelValue', date)
  await datePicker.vm.$emit('date-select')
  await flushPromises()
}

function findRetryButton(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('button').find((b) => b.text() === 'Erneut versuchen')
}

describe('TransactionsByMonthView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user = { permissions: [] }
    mockGetTransactionsByMonth.mockResolvedValue({ data: buildResult() })
    mockGetDashboard.mockResolvedValue({ data: { categories } })
  })

  it('loads transactions and categories for the given account/year/month on mount', async () => {
    const { wrapper } = await mountAt(JUNE)

    expect(mockGetTransactionsByMonth).toHaveBeenCalledOnce()
    expect(mockGetTransactionsByMonth).toHaveBeenCalledWith(ACCOUNT_ID, 2026, 6, 1)
    expect(mockGetDashboard).toHaveBeenCalledOnce()
    const table = wrapper.findComponent({ name: 'TransactionTable' })
    expect(table.props('transactions')).toEqual([buildTx()])
    expect(table.props('categories')).toEqual(categories)
    wrapper.unmount()
  })

  it('shows the account label, the month and the balances once loaded', async () => {
    const { wrapper } = await mountAt(JUNE)

    expect(wrapper.text()).toContain('Kasse Wien')
    expect(wrapper.find('.info-card').exists()).toBe(true)
    expect(wrapper.find('.info-card').text()).toContain('Juni 2026')
    wrapper.unmount()
  })

  it('gives the month picker an accessible name', async () => {
    const { wrapper } = await mountAt(JUNE)

    expect(wrapper.find('input').attributes('aria-label')).toBe('Monat wählen')
    wrapper.unmount()
  })

  it('passes the admin flag from the auth store to TransactionTable', async () => {
    mockAuthStore.user = { permissions: ['p4xAdmin'] }
    const { wrapper } = await mountAt(JUNE)

    expect(wrapper.findComponent({ name: 'TransactionTable' }).props('admin')).toBe(true)
    wrapper.unmount()
  })

  it('reloads with the new page when TransactionTable emits pageChange', async () => {
    const { wrapper } = await mountAt(JUNE)

    mockGetTransactionsByMonth.mockResolvedValue({ data: buildResult({ page: 2 }) })
    await wrapper.findComponent({ name: 'TransactionTable' }).vm.$emit('pageChange', 2)
    await flushPromises()

    expect(mockGetTransactionsByMonth).toHaveBeenLastCalledWith(ACCOUNT_ID, 2026, 6, 2)
    expect(mockGetDashboard).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('reloads the current page when TransactionTable emits refresh', async () => {
    mockGetTransactionsByMonth.mockResolvedValue({ data: buildResult({ page: 3 }) })
    const { wrapper } = await mountAt(JUNE)

    await wrapper.findComponent({ name: 'TransactionTable' }).vm.$emit('refresh')
    await flushPromises()

    expect(mockGetTransactionsByMonth).toHaveBeenLastCalledWith(ACCOUNT_ID, 2026, 6, 3)
    wrapper.unmount()
  })

  it('changes the route and loads the new month exactly once when a month is picked', async () => {
    const { wrapper, router } = await mountAt(JUNE)
    mockGetTransactionsByMonth.mockClear()

    await pickMonth(wrapper, new Date(2026, 6, 1))

    expect(router.currentRoute.value.params).toMatchObject({
      accountId: ACCOUNT_ID,
      year: '2026',
      month: '7',
    })
    expect(mockGetTransactionsByMonth).toHaveBeenCalledOnce()
    expect(mockGetTransactionsByMonth).toHaveBeenCalledWith(ACCOUNT_ID, 2026, 7, 1)
    wrapper.unmount()
  })

  it('takes the year from the picked date, not from the current route', async () => {
    const { wrapper, router } = await mountAt(JUNE)
    mockGetTransactionsByMonth.mockClear()

    await pickMonth(wrapper, new Date(2025, 0, 1))

    expect(router.currentRoute.value.params).toMatchObject({ year: '2025', month: '1' })
    expect(mockGetTransactionsByMonth).toHaveBeenCalledWith(ACCOUNT_ID, 2025, 1, 1)
    wrapper.unmount()
  })

  it('does not offer a month in the future', async () => {
    const { wrapper } = await mountAt(JUNE)

    const maxDate = wrapper.findComponent({ name: 'DatePicker' }).props('maxDate') as Date
    expect(maxDate).toBeInstanceOf(Date)
    expect(Math.abs(maxDate.getTime() - Date.now())).toBeLessThan(60_000)
    wrapper.unmount()
  })

  it('follows the route when the month changes without the picker (browser back)', async () => {
    const { wrapper, router } = await mountAt(JUNE)
    mockGetTransactionsByMonth.mockClear()

    await router.push(`/p4x/accounts/${ACCOUNT_ID}/transactions/by-month/2026/5`)
    await flushPromises()

    expect(mockGetTransactionsByMonth).toHaveBeenCalledOnce()
    expect(mockGetTransactionsByMonth).toHaveBeenCalledWith(ACCOUNT_ID, 2026, 5, 1)
    const picked = wrapper.findComponent({ name: 'DatePicker' }).props('modelValue') as Date
    expect(picked.getFullYear()).toBe(2026)
    expect(picked.getMonth()).toBe(4)
    wrapper.unmount()
  })

  it('does not load anything when a kept-alive view sees a route without a month', async () => {
    const { wrapper, router } = await mountAt(JUNE, { keepAlive: true })
    mockGetTransactionsByMonth.mockClear()

    await router.push('/p4x')
    await flushPromises()

    expect(mockGetTransactionsByMonth).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows a retry state instead of the previous month when loading another month fails', async () => {
    const { wrapper } = await mountAt(JUNE)
    expect(wrapper.find('.info-card').exists()).toBe(true)

    mockGetTransactionsByMonth.mockRejectedValueOnce(new Error('boom'))
    await pickMonth(wrapper, new Date(2026, 6, 1))

    expect(wrapper.find('.info-card').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(false)
    expect(findRetryButton(wrapper)).toBeTruthy()
    wrapper.unmount()
  })

  it('retries the failed month when the retry button is pressed', async () => {
    mockGetTransactionsByMonth.mockRejectedValueOnce(new Error('boom'))
    const { wrapper } = await mountAt(JUNE)
    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(false)

    await findRetryButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(mockGetTransactionsByMonth).toHaveBeenLastCalledWith(ACCOUNT_ID, 2026, 6, 1)
    expect(findRetryButton(wrapper)).toBeUndefined()
    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows the newest month when an older, slower response arrives late', async () => {
    const { wrapper } = await mountAt(JUNE)
    const july = deferred<{ data: PaginatedTransactions }>()
    mockGetTransactionsByMonth.mockReturnValueOnce(july.promise)
    mockGetTransactionsByMonth.mockResolvedValueOnce({
      data: buildResult({ items: [buildTx({ id: 'august-tx' })] }),
    })

    await pickMonth(wrapper, new Date(2026, 6, 1))
    await pickMonth(wrapper, new Date(2026, 7, 1))
    july.resolve({ data: buildResult({ items: [buildTx({ id: 'july-tx' })] }) })
    await flushPromises()

    const table = wrapper.findComponent({ name: 'TransactionTable' })
    expect((table.props('transactions') as P4xTransaction[]).map((t) => t.id)).toEqual([
      'august-tx',
    ])
    wrapper.unmount()
  })

  it('shows a retry state instead of a table when the transactions cannot be loaded', async () => {
    mockGetTransactionsByMonth.mockRejectedValueOnce(new Error('boom'))
    const { wrapper } = await mountAt(JUNE)

    expect(wrapper.text()).toContain('Transaktionen konnten nicht geladen werden.')
    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(false)
    expect(wrapper.find('.info-card').exists()).toBe(false)

    await findRetryButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(mockGetTransactionsByMonth).toHaveBeenLastCalledWith(ACCOUNT_ID, 2026, 6, 1)
    expect(wrapper.text()).not.toContain('konnten nicht geladen werden')
    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows a retry state when the categories cannot be loaded', async () => {
    mockGetDashboard.mockRejectedValueOnce(new Error('boom'))
    const { wrapper } = await mountAt(JUNE)

    expect(findRetryButton(wrapper)).toBeDefined()
    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(false)

    await findRetryButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(mockGetDashboard).toHaveBeenCalledTimes(2)
    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows the balance at the start and at the end of the month in that order', async () => {
    const { wrapper } = await mountAt(JUNE)

    const rows = wrapper.findAll('.info-row').map((row) => row.text().replace(/\s+/g, ' '))
    expect(rows.find((t) => t.startsWith('Kontostand zum Monatsersten'))).toMatch(/(?<!\d)5,00/)
    expect(rows.find((t) => t.startsWith('Kontostand zum Monatsletzten'))).toContain('15,00')
    wrapper.unmount()
  })

  it('names the account "Konto" while the month has no transactions', async () => {
    mockGetTransactionsByMonth.mockResolvedValue({ data: buildResult({ items: [], total: 0 }) })
    const { wrapper } = await mountAt(JUNE)

    expect(wrapper.find('.subtitle').text()).toBe('Konto')
    wrapper.unmount()
  })

  it('does not let the picker go beyond the current month', async () => {
    const { wrapper } = await mountAt(JUNE)

    const maxDate = wrapper.findComponent({ name: 'DatePicker' }).props('maxDate') as Date
    expect(maxDate.toDateString()).toBe(new Date().toDateString())
    wrapper.unmount()
  })
})
