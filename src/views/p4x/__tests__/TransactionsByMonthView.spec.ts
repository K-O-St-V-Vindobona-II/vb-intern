import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TransactionsByMonthView from '../TransactionsByMonthView.vue'
import PrimeVue from 'primevue/config'
import type { P4xCategory, P4xTransaction, PaginatedTransactions } from '@/types/p4x'

const mockReplace = vi.fn()
const mockRoute = { params: { accountId: '2', year: '2026', month: '6' } }
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
  useRouter: vi.fn(() => ({ replace: mockReplace })),
}))

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
    p4x_account_id: '2',
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
  RouterLink: { template: '<a><slot /></a>' },
  TransactionTable: {
    name: 'TransactionTable',
    template: '<div class="transaction-table-stub" />',
    props: ['transactions', 'categories', 'total', 'page', 'perPage', 'admin'],
    emits: ['pageChange', 'refresh'],
  },
}

const mountOpts = { global: { plugins: [PrimeVue], stubs }, attachTo: document.body }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function findRetryButton(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('button').find((b) => b.text() === 'Erneut versuchen')
}

async function pickMonth(wrapper: ReturnType<typeof mount>, date: Date) {
  const datePicker = wrapper.findComponent({ name: 'DatePicker' })
  await datePicker.vm.$emit('update:modelValue', date)
  await datePicker.vm.$emit('date-select')
}

describe('TransactionsByMonthView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user = { permissions: [] }
    mockRoute.params = { accountId: '2', year: '2026', month: '6' }
    mockGetTransactionsByMonth.mockResolvedValue({ data: buildResult() })
    mockGetDashboard.mockResolvedValue({ data: { categories } })
  })

  it('loads transactions and categories for the given account/year/month on mount', async () => {
    const wrapper = mount(TransactionsByMonthView, mountOpts)
    await flushPromises()

    expect(mockGetTransactionsByMonth).toHaveBeenCalledWith('2', 2026, 6, 1)
    expect(mockGetDashboard).toHaveBeenCalledOnce()
    const table = wrapper.findComponent({ name: 'TransactionTable' })
    expect(table.props('transactions')).toEqual([buildTx()])
    expect(table.props('categories')).toEqual(categories)
    wrapper.unmount()
  })

  it('shows the account label and balances once loaded', async () => {
    const wrapper = mount(TransactionsByMonthView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Kasse Wien')
    expect(wrapper.find('.info-card').exists()).toBe(true)
    wrapper.unmount()
  })

  it('passes the admin flag from the auth store to TransactionTable', async () => {
    mockAuthStore.user = { permissions: ['p4xAdmin'] }
    const wrapper = mount(TransactionsByMonthView, mountOpts)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'TransactionTable' }).props('admin')).toBe(true)
    wrapper.unmount()
  })

  it('reloads with the new page when TransactionTable emits pageChange', async () => {
    const wrapper = mount(TransactionsByMonthView, mountOpts)
    await flushPromises()

    mockGetTransactionsByMonth.mockResolvedValue({ data: buildResult({ page: 2 }) })
    await wrapper.findComponent({ name: 'TransactionTable' }).vm.$emit('pageChange', 2)
    await flushPromises()

    expect(mockGetTransactionsByMonth).toHaveBeenLastCalledWith('2', 2026, 6, 2)
    expect(mockGetDashboard).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('reloads the current page when TransactionTable emits refresh', async () => {
    mockGetTransactionsByMonth.mockResolvedValue({ data: buildResult({ page: 3 }) })
    const wrapper = mount(TransactionsByMonthView, mountOpts)
    await flushPromises()

    await wrapper.findComponent({ name: 'TransactionTable' }).vm.$emit('refresh')
    await flushPromises()

    expect(mockGetTransactionsByMonth).toHaveBeenLastCalledWith('2', 2026, 6, 3)
    wrapper.unmount()
  })

  it('updates the route and reloads when a new month is picked', async () => {
    const wrapper = mount(TransactionsByMonthView, mountOpts)
    await flushPromises()

    mockGetTransactionsByMonth.mockResolvedValue({ data: buildResult() })
    const datePicker = wrapper.findComponent({ name: 'DatePicker' })
    await datePicker.vm.$emit('update:modelValue', new Date(2026, 6, 1))
    await datePicker.vm.$emit('date-select')
    await flushPromises()

    expect(mockReplace).toHaveBeenCalledWith({
      name: 'p4x-transactions-month',
      params: { accountId: '2', year: 2026, month: 7 },
    })
    expect(mockGetTransactionsByMonth).toHaveBeenLastCalledWith('2', 2026, 7, 1)
    wrapper.unmount()
  })

  it('shows a retry state instead of a table when the transactions cannot be loaded', async () => {
    mockGetTransactionsByMonth.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(TransactionsByMonthView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Transaktionen konnten nicht geladen werden.')
    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(false)
    expect(wrapper.find('.info-card').exists()).toBe(false)

    await findRetryButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(mockGetTransactionsByMonth).toHaveBeenLastCalledWith('2', 2026, 6, 1)
    expect(wrapper.text()).not.toContain('konnten nicht geladen werden')
    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows a retry state when the categories cannot be loaded', async () => {
    mockGetDashboard.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(TransactionsByMonthView, mountOpts)
    await flushPromises()

    expect(findRetryButton(wrapper)).toBeDefined()
    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(false)

    await findRetryButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(mockGetDashboard).toHaveBeenCalledTimes(2)
    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('never shows the month heading and rows of the previous month when loading another month fails', async () => {
    const wrapper = mount(TransactionsByMonthView, mountOpts)
    await flushPromises()
    expect(wrapper.find('.info-card').text()).toContain('Juni 2026')

    mockGetTransactionsByMonth.mockRejectedValueOnce(new Error('boom'))
    await pickMonth(wrapper, new Date(2026, 6, 1))
    await flushPromises()

    expect(wrapper.find('.info-card').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Juli 2026')
    wrapper.unmount()
  })

  it('shows the rows of the newest month when an older, slower response arrives late', async () => {
    const wrapper = mount(TransactionsByMonthView, mountOpts)
    await flushPromises()
    const slow = deferred<{ data: PaginatedTransactions }>()
    mockGetTransactionsByMonth.mockReturnValueOnce(slow.promise)
    mockGetTransactionsByMonth.mockResolvedValueOnce({
      data: buildResult({ items: [buildTx({ id: 'newest-tx' })] }),
    })

    await pickMonth(wrapper, new Date(2026, 6, 1))
    await pickMonth(wrapper, new Date(2026, 7, 1))
    await flushPromises()
    slow.resolve({ data: buildResult({ items: [buildTx({ id: 'older-tx' })] }) })
    await flushPromises()

    const table = wrapper.findComponent({ name: 'TransactionTable' })
    expect((table.props('transactions') as P4xTransaction[]).map((t) => t.id)).toEqual([
      'newest-tx',
    ])
    wrapper.unmount()
  })
})
