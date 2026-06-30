import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TransactionsByPartnerView from '../TransactionsByPartnerView.vue'
import PrimeVue from 'primevue/config'
import type { P4xCategory, P4xTransaction, PaginatedTransactions } from '@/types/p4x'

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ params: { accountId: '2' } })),
}))

const mockAuthStore: { user: { permissions: string[] } | null } = { user: { permissions: [] } }
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

const mockGetTransactionsByPartner = vi.fn()
const mockGetDashboard = vi.fn()
const mockSearchPartners = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getTransactionsByPartner: (...args: unknown[]) => mockGetTransactionsByPartner(...args),
    getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
    searchPartners: (...args: unknown[]) => mockSearchPartners(...args),
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

async function selectPartner(
  wrapper: ReturnType<typeof mount>,
  item: { type: string; id: number; label: string },
) {
  const search = wrapper.findComponent({ name: 'PersonSearchField' })
  await search.vm.$emit('select', item)
}

describe('TransactionsByPartnerView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user = { permissions: [] }
    mockGetDashboard.mockResolvedValue({ data: { categories } })
    mockGetTransactionsByPartner.mockResolvedValue({ data: buildResult() })
  })

  it('loads categories on mount', async () => {
    const wrapper = mount(TransactionsByPartnerView, mountOpts)
    await flushPromises()

    expect(mockGetDashboard).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('does not show the TransactionTable before a partner is selected', async () => {
    const wrapper = mount(TransactionsByPartnerView, mountOpts)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'TransactionTable' }).exists()).toBe(false)
    wrapper.unmount()
  })

  it('forwards the query to searchPartners via the search-fn prop', async () => {
    mockSearchPartners.mockResolvedValue({
      data: [{ id: 1, label: 'Mitglied: Max', type: 'member' }],
    })
    const wrapper = mount(TransactionsByPartnerView, mountOpts)
    await flushPromises()

    const search = wrapper.findComponent({ name: 'PersonSearchField' })
    const found = await (search.props('searchFn') as (q: string) => Promise<unknown>)('Max')

    expect(mockSearchPartners).toHaveBeenCalledWith('Max')
    expect(found).toEqual([{ id: 1, label: 'Mitglied: Max', type: 'member' }])
    wrapper.unmount()
  })

  it('loads and shows transactions for the selected partner', async () => {
    const wrapper = mount(TransactionsByPartnerView, mountOpts)
    await flushPromises()

    await selectPartner(wrapper, { type: 'member', id: 5, label: 'Mitglied: Max Mustermann' })
    await flushPromises()

    expect(mockGetTransactionsByPartner).toHaveBeenCalledWith(2, 'member', 5, 1)
    const table = wrapper.findComponent({ name: 'TransactionTable' })
    expect(table.exists()).toBe(true)
    wrapper.unmount()
  })

  it('splits the partner label into a type and a name in the info card', async () => {
    const wrapper = mount(TransactionsByPartnerView, mountOpts)
    await flushPromises()

    await selectPartner(wrapper, { type: 'member', id: 5, label: 'Mitglied: Max Mustermann' })
    await flushPromises()

    const infoRow = wrapper.find('.info-row')
    expect(infoRow.text()).toContain('Mitglied')
    expect(infoRow.text()).toContain('Max Mustermann')
    wrapper.unmount()
  })

  it('passes the admin flag from the auth store', async () => {
    mockAuthStore.user = { permissions: ['p4xAdmin'] }
    const wrapper = mount(TransactionsByPartnerView, mountOpts)
    await flushPromises()

    await selectPartner(wrapper, { type: 'member', id: 5, label: 'Mitglied: Max' })
    await flushPromises()

    expect(wrapper.findComponent({ name: 'TransactionTable' }).props('admin')).toBe(true)
    wrapper.unmount()
  })

  it('reloads with the new page when TransactionTable emits pageChange', async () => {
    const wrapper = mount(TransactionsByPartnerView, mountOpts)
    await flushPromises()
    await selectPartner(wrapper, { type: 'member', id: 5, label: 'Mitglied: Max' })
    await flushPromises()

    mockGetTransactionsByPartner.mockResolvedValue({ data: buildResult({ page: 2 }) })
    await wrapper.findComponent({ name: 'TransactionTable' }).vm.$emit('pageChange', 2)
    await flushPromises()

    expect(mockGetTransactionsByPartner).toHaveBeenLastCalledWith(2, 'member', 5, 2)
    wrapper.unmount()
  })

  it('reloads the current page when TransactionTable emits refresh', async () => {
    mockGetTransactionsByPartner.mockResolvedValue({ data: buildResult({ page: 3 }) })
    const wrapper = mount(TransactionsByPartnerView, mountOpts)
    await flushPromises()
    await selectPartner(wrapper, { type: 'member', id: 5, label: 'Mitglied: Max' })
    await flushPromises()

    await wrapper.findComponent({ name: 'TransactionTable' }).vm.$emit('refresh')
    await flushPromises()

    expect(mockGetTransactionsByPartner).toHaveBeenLastCalledWith(2, 'member', 5, 3)
    wrapper.unmount()
  })
})
