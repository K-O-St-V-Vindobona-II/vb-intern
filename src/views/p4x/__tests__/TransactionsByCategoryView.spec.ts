import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TransactionsByCategoryView from '../TransactionsByCategoryView.vue'
import PrimeVue from 'primevue/config'
import type { P4xCategory, P4xTransaction, PaginatedTransactions } from '@/types/p4x'

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ params: { accountId: '2' } })),
}))

const mockAuthStore: { user: { permissions: string[] } | null } = { user: { permissions: [] } }
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

const mockGetTransactionsByCategory = vi.fn()
const mockGetDashboard = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getTransactionsByCategory: (...args: unknown[]) => mockGetTransactionsByCategory(...args),
    getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
  },
}))

const categories: P4xCategory[] = [
  {
    id: 1,
    name: 'spende',
    label: 'Spende',
    background_color: '#fff',
    text_color: '#000',
    protected: false,
  },
  {
    id: 2,
    name: 'beitrag',
    label: 'Beitrag',
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
    props: ['transactions', 'categories', 'total', 'page', 'perPage', 'admin'],
    emits: ['pageChange', 'refresh'],
  },
}

const mountOpts = { global: { plugins: [PrimeVue], stubs }, attachTo: document.body }

async function selectCategory(wrapper: ReturnType<typeof mount>, id: number) {
  const select = wrapper.findComponent({ name: 'Select' })
  await select.vm.$emit('update:modelValue', id)
  await select.vm.$emit('change')
}

describe('TransactionsByCategoryView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user = { permissions: [] }
    mockGetDashboard.mockResolvedValue({ data: { categories } })
    mockGetTransactionsByCategory.mockResolvedValue({ data: buildResult() })
  })

  it('loads the categories for the select on mount', async () => {
    const wrapper = mount(TransactionsByCategoryView, mountOpts)
    await flushPromises()

    expect(mockGetDashboard).toHaveBeenCalledOnce()
    expect(wrapper.findComponent({ name: 'Select' }).props('options')).toEqual(categories)
    wrapper.unmount()
  })

  it('does not show the TransactionTable before a category is selected', async () => {
    const wrapper = mount(TransactionsByCategoryView, mountOpts)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(false)
    wrapper.unmount()
  })

  it('loads and shows transactions for the selected category', async () => {
    const wrapper = mount(TransactionsByCategoryView, mountOpts)
    await flushPromises()

    await selectCategory(wrapper, 1)
    await flushPromises()

    expect(mockGetTransactionsByCategory).toHaveBeenCalledWith(2, 1, 1)
    const table = wrapper.findComponent({ name: 'TransactionTable' })
    expect(table.exists()).toBe(true)
    expect(table.props('categories')).toEqual(categories)
    wrapper.unmount()
  })

  it('shows the selected category name and label in the info card', async () => {
    const wrapper = mount(TransactionsByCategoryView, mountOpts)
    await flushPromises()

    await selectCategory(wrapper, 2)
    await flushPromises()

    expect(wrapper.find('.info-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('beitrag')
    wrapper.unmount()
  })

  it('passes the admin flag from the auth store', async () => {
    mockAuthStore.user = { permissions: ['p4xAdmin'] }
    const wrapper = mount(TransactionsByCategoryView, mountOpts)
    await flushPromises()

    await selectCategory(wrapper, 1)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'TransactionTable' }).props('admin')).toBe(true)
    wrapper.unmount()
  })

  it('reloads with the new page when TransactionTable emits pageChange', async () => {
    const wrapper = mount(TransactionsByCategoryView, mountOpts)
    await flushPromises()
    await selectCategory(wrapper, 1)
    await flushPromises()

    mockGetTransactionsByCategory.mockResolvedValue({ data: buildResult({ page: 2 }) })
    await wrapper.findComponent({ name: 'TransactionTable' }).vm.$emit('pageChange', 2)
    await flushPromises()

    expect(mockGetTransactionsByCategory).toHaveBeenLastCalledWith(2, 1, 2)
    wrapper.unmount()
  })

  it('reloads the current page when TransactionTable emits refresh', async () => {
    mockGetTransactionsByCategory.mockResolvedValue({ data: buildResult({ page: 3 }) })
    const wrapper = mount(TransactionsByCategoryView, mountOpts)
    await flushPromises()
    await selectCategory(wrapper, 1)
    await flushPromises()

    await wrapper.findComponent({ name: 'TransactionTable' }).vm.$emit('refresh')
    await flushPromises()

    expect(mockGetTransactionsByCategory).toHaveBeenLastCalledWith(2, 1, 3)
    wrapper.unmount()
  })

  it('clears the result and reloads when switching to a different category', async () => {
    const wrapper = mount(TransactionsByCategoryView, mountOpts)
    await flushPromises()
    await selectCategory(wrapper, 1)
    await flushPromises()

    mockGetTransactionsByCategory.mockResolvedValue({
      data: buildResult({ items: [buildTx({ id: 2 })] }),
    })
    await selectCategory(wrapper, 2)
    await flushPromises()

    expect(mockGetTransactionsByCategory).toHaveBeenLastCalledWith(2, 2, 1)
    expect(wrapper.findComponent({ name: 'TransactionTable' }).props('transactions')).toEqual([
      buildTx({ id: 2 }),
    ])
    wrapper.unmount()
  })
})
