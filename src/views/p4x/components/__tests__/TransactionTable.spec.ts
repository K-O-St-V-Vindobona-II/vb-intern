import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TransactionTable from '../TransactionTable.vue'
import PrimeVue from 'primevue/config'
import type { P4xTransaction, P4xCategory } from '@/types/p4x'

const mockGetTransactionRaw = vi.fn()
const mockGetTransactionAttachment = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getTransactionRaw: (...args: unknown[]) => mockGetTransactionRaw(...args),
    getTransactionAttachment: (...args: unknown[]) => mockGetTransactionAttachment(...args),
  },
}))

function buildTransaction(overrides: Partial<P4xTransaction> = {}): P4xTransaction {
  return {
    id: 1,
    booking: '2026-06-01',
    valuation: '2026-06-02',
    iban: 'AT001234',
    amount: 10,
    subject: 'Spende',
    p4x_account_id: 1,
    p4x_account_cn: 'Kasse',
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

// CategoryDirectEditor/TransactionEditor are dialogs with their own dedicated
// tests; stub them here as thin fakes exposing the same open() API so
// TransactionTable's own wiring (refs, click handlers) can still be verified.
const stubs = {
  CategoryDirectEditor: { template: '<div />', methods: { open: vi.fn() } },
  TransactionEditor: { template: '<div />', methods: { open: vi.fn() } },
  PartnerEditor: { template: '<div />', methods: { open: vi.fn() } },
}

const mountOpts = { global: { plugins: [PrimeVue], stubs }, attachTo: document.body }

describe('TransactionTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows an empty state when there are no transactions', () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [], categories },
      ...mountOpts,
    })
    expect(wrapper.text()).toContain('Keine Transaktionen vorhanden')
    wrapper.unmount()
  })

  it('shows the title when given', () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [], categories, title: 'Letzte Buchungen' },
      ...mountOpts,
    })
    expect(wrapper.text()).toContain('Letzte Buchungen')
    wrapper.unmount()
  })

  it('shows a warning when a transaction has no partner', () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction({ partner: null })], categories },
      ...mountOpts,
    })
    expect(wrapper.text()).toContain('Kein Partner gesetzt!')
    wrapper.unmount()
  })

  it('shows the partner label when a partner is set', () => {
    const wrapper = mount(TransactionTable, {
      props: {
        transactions: [
          buildTransaction({ partner: { type: 'member', id: 5, cn: 'Max Mustermann' } }),
        ],
        categories,
      },
      ...mountOpts,
    })
    expect(wrapper.text()).toContain('Max Mustermann')
    wrapper.unmount()
  })

  it('shows a warning when no category is assigned', () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction()], categories },
      ...mountOpts,
    })
    expect(wrapper.text()).toContain('Keine Kategorie!')
    wrapper.unmount()
  })

  it('shows the direct category with its amount when multiple direct splits exist', () => {
    const tx = buildTransaction({
      p4x_category_directs: [
        { id: 1, p4x_category_id: 1, amount: 4 },
        { id: 2, p4x_category_id: 1, amount: 6 },
      ],
    })
    const wrapper = mount(TransactionTable, {
      props: { transactions: [tx], categories },
      ...mountOpts,
    })
    expect(wrapper.text()).toContain('Spende')
    expect(wrapper.text()).toContain('4,00')
    wrapper.unmount()
  })

  it('warns about ambiguous category filters when more than one applies', () => {
    const tx = buildTransaction({
      p4x_category_filters: [
        { id: 1, p4x_category_id: 1 },
        { id: 2, p4x_category_id: 1 },
      ],
    })
    const wrapper = mount(TransactionTable, {
      props: { transactions: [tx], categories },
      ...mountOpts,
    })
    expect(wrapper.text()).toContain('Uneindeutige Kategorie-Filter!')
    wrapper.unmount()
  })

  it('does not show pagination controls without page/total/perPage', () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction()], categories },
      ...mountOpts,
    })
    expect(wrapper.find('.tx-pagination').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows pagination controls and disables prev/next at the boundaries', () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction()], categories, total: 30, perPage: 10, page: 1 },
      ...mountOpts,
    })
    expect(wrapper.find('.tx-pagination').exists()).toBe(true)
    expect(wrapper.text()).toContain('Seite 1 / 3')
    const buttons = wrapper.findAll('.tx-pager button')
    expect(buttons[0]!.attributes('disabled')).toBeDefined() // first
    expect(buttons[1]!.attributes('disabled')).toBeDefined() // prev
    expect(buttons[2]!.attributes('disabled')).toBeUndefined() // next
    wrapper.unmount()
  })

  it('emits pageChange with the next page number', async () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction()], categories, total: 30, perPage: 10, page: 1 },
      ...mountOpts,
    })
    await wrapper.findAll('.tx-pager button')[2]!.trigger('click') // next
    expect(wrapper.emitted('pageChange')).toEqual([[2]])
    wrapper.unmount()
  })

  it('fetches and shows the raw transaction data when requested', async () => {
    mockGetTransactionRaw.mockResolvedValue({ data: { raw: JSON.stringify({ foo: 'bar' }) } })
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction({ id: 4, p4x_account_id: 2 })], categories },
      ...mountOpts,
    })

    // The raw-data icon lives inside the DataTable's row-expansion slot,
    // which only renders once the row has been expanded.
    await wrapper.find('.p-datatable-row-toggle-button').trigger('click')
    await wrapper.find('.pi-search').trigger('click')
    await flushPromises()

    expect(mockGetTransactionRaw).toHaveBeenCalledWith(2, 4)
    expect(document.querySelector('.raw-json')?.textContent).toContain('"foo": "bar"')
    wrapper.unmount()
  })

  it('downloads the attachment when the paperclip icon is clicked', async () => {
    mockGetTransactionAttachment.mockResolvedValue({ data: new Blob(['x']) })
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const wrapper = mount(TransactionTable, {
      props: {
        transactions: [buildTransaction({ id: 4, p4x_account_id: 2, has_attachment: true })],
        categories,
      },
      ...mountOpts,
    })

    await wrapper.find('.pi-paperclip').trigger('click')
    await flushPromises()

    expect(mockGetTransactionAttachment).toHaveBeenCalledWith(2, 4)
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')

    clickSpy.mockRestore()
    wrapper.unmount()
  })

  it('does not show admin-only category/partner edit icons or actions for non-admins', async () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction()], categories, admin: false },
      ...mountOpts,
    })
    await wrapper.find('.p-datatable-row-toggle-button').trigger('click')
    expect(wrapper.find('.category-edit-icon').exists()).toBe(false)
    expect(wrapper.find('.partner-edit-icon').exists()).toBe(false)
    expect(wrapper.find('.admin-action').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows admin-only category/partner edit icons and comment/attachment action for admins', async () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction()], categories, admin: true },
      ...mountOpts,
    })
    await wrapper.find('.p-datatable-row-toggle-button').trigger('click')
    expect(wrapper.find('.category-edit-icon').exists()).toBe(true)
    expect(wrapper.find('.partner-edit-icon').exists()).toBe(true)
    expect(wrapper.find('.admin-action').exists()).toBe(true)
    wrapper.unmount()
  })
})
