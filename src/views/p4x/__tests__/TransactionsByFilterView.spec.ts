import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TransactionsByFilterView from '../TransactionsByFilterView.vue'
import PrimeVue from 'primevue/config'
import type {
  CategoryFilter,
  P4xCategory,
  P4xTransaction,
  PaginatedTransactions,
} from '@/types/p4x'

const mockRoute = { params: { accountId: '2' }, query: {} as Record<string, string> }
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
}))

const mockGetCategoryFilters = vi.fn()
const mockGetDashboard = vi.fn()
const mockGetTransactionsByFilter = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getCategoryFilters: (...args: unknown[]) => mockGetCategoryFilters(...args),
    getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
    getTransactionsByFilter: (...args: unknown[]) => mockGetTransactionsByFilter(...args),
  },
}))

function buildFilter(overrides: Partial<CategoryFilter> = {}): CategoryFilter {
  return {
    id: 1,
    name: 'Filter A',
    p4x_account_id: 2,
    p4x_account_label: 'Kasse',
    iban: null,
    min_amount: null,
    max_amount: null,
    subject: null,
    subject_mode: 'equals',
    p4x_category_id: 1,
    hitCount: 4,
    ...overrides,
  }
}

const categories: P4xCategory[] = [
  {
    id: 1,
    name: 'spende',
    label: 'Spende',
    background_color: '#fff',
    text_color: '#000',
    protected: false,
  },
]

function buildTx(overrides: Partial<P4xTransaction> = {}): P4xTransaction {
  return {
    id: 1,
    booking: '2026-06-01',
    valuation: '2026-06-01',
    iban: 'AT001234',
    amount: 10,
    subject: 'Spende',
    p4x_account_id: 2,
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
  return { items: [buildTx()], total: 1, page: 1, per_page: 50, ...overrides }
}

const stubs = {
  RouterLink: { template: '<a><slot /></a>' },
  TransactionTable: {
    name: 'TransactionTable',
    template: '<div class="transaction-table-stub" />',
    props: {
      transactions: Array,
      categories: Array,
      total: Number,
      page: Number,
      perPage: Number,
      admin: Boolean,
    },
    emits: ['pageChange', 'refresh'],
  },
}

const mountOpts = { global: { plugins: [PrimeVue], stubs }, attachTo: document.body }

async function selectFilter(wrapper: ReturnType<typeof mount>, id: number) {
  const select = wrapper.findComponent({ name: 'Select' })
  await select.vm.$emit('update:modelValue', id)
  await select.vm.$emit('change')
}

describe('TransactionsByFilterView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.query = {}
    mockGetCategoryFilters.mockResolvedValue({
      data: [buildFilter({ id: 1, p4x_account_id: 2 }), buildFilter({ id: 2, p4x_account_id: 9 })],
    })
    mockGetDashboard.mockResolvedValue({ data: { categories } })
    mockGetTransactionsByFilter.mockResolvedValue({ data: buildResult() })
  })

  it('loads only the filters belonging to the current account', async () => {
    const wrapper = mount(TransactionsByFilterView, mountOpts)
    await flushPromises()

    const options = wrapper.findComponent({ name: 'Select' }).props('options') as Array<{
      label: string
    }>
    expect(options).toEqual([{ label: 'Filter A', value: 1 }])
    wrapper.unmount()
  })

  it('does not show the TransactionTable before a filter is selected', async () => {
    const wrapper = mount(TransactionsByFilterView, mountOpts)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(false)
    wrapper.unmount()
  })

  it('preselects and loads the filter given via the filterId query param', async () => {
    mockRoute.query = { filterId: '1' }
    const wrapper = mount(TransactionsByFilterView, mountOpts)
    await flushPromises()

    expect(mockGetTransactionsByFilter).toHaveBeenCalledWith(2, 1, 1)
    const select = wrapper.findComponent({ name: 'Select' })
    expect(select.props('modelValue')).toBe(1)
    wrapper.unmount()
  })

  it('ignores a filterId query param that does not belong to this account', async () => {
    mockRoute.query = { filterId: '2' }
    const wrapper = mount(TransactionsByFilterView, mountOpts)
    await flushPromises()

    expect(mockGetTransactionsByFilter).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(false)
    wrapper.unmount()
  })

  it('loads transactions for the selected filter and always sets admin true', async () => {
    const wrapper = mount(TransactionsByFilterView, mountOpts)
    await flushPromises()

    await selectFilter(wrapper, 1)
    await flushPromises()

    expect(mockGetTransactionsByFilter).toHaveBeenCalledWith(2, 1, 1)
    const table = wrapper.findComponent({ name: 'TransactionTable' })
    expect(table.props('admin')).toBe(true)
    wrapper.unmount()
  })

  it('reloads with the new page when TransactionTable emits pageChange', async () => {
    const wrapper = mount(TransactionsByFilterView, mountOpts)
    await flushPromises()
    await selectFilter(wrapper, 1)
    await flushPromises()

    mockGetTransactionsByFilter.mockResolvedValue({ data: buildResult({ page: 2 }) })
    await wrapper.findComponent({ name: 'TransactionTable' }).vm.$emit('pageChange', 2)
    await flushPromises()

    expect(mockGetTransactionsByFilter).toHaveBeenLastCalledWith(2, 1, 2)
    wrapper.unmount()
  })

  it('reloads the current page when TransactionTable emits refresh', async () => {
    mockGetTransactionsByFilter.mockResolvedValue({ data: buildResult({ page: 3 }) })
    const wrapper = mount(TransactionsByFilterView, mountOpts)
    await flushPromises()
    await selectFilter(wrapper, 1)
    await flushPromises()

    await wrapper.findComponent({ name: 'TransactionTable' }).vm.$emit('refresh')
    await flushPromises()

    expect(mockGetTransactionsByFilter).toHaveBeenLastCalledWith(2, 1, 3)
    wrapper.unmount()
  })
})
