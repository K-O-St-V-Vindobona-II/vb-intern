import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TransactionTable from '../TransactionTable.vue'
import PrimeVue from 'primevue/config'
import type { P4xTransaction, P4xCategory, CategoryFilterShort } from '@/types/p4x'

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockCreateObjectURL = vi.fn(() => 'blob:mock')
const mockRevokeObjectURL = vi.fn()
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

beforeAll(() => {
  URL.createObjectURL = mockCreateObjectURL
  URL.revokeObjectURL = mockRevokeObjectURL
})

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
})

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
    id: 'transaction-uuid-1',
    booking: '2026-06-01',
    valuation: '2026-06-02',
    iban: 'AT001234',
    amount: 10,
    subject: 'Spende',
    p4x_account_id: '1',
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

function buildFilter(overrides: Partial<CategoryFilterShort> = {}): CategoryFilterShort {
  return {
    id: 'filter-uuid-1',
    name: 'Filter A',
    p4x_account_id: '1',
    p4x_account_label: 'Kasse',
    iban: null,
    min_amount: null,
    max_amount: null,
    subject: null,
    subject_mode: 'equals',
    p4x_category_id: 'category-uuid-1',
    hitCount: 1,
    ...overrides,
  }
}

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

// CategoryDirectEditor/TransactionEditor are dialogs with their own dedicated
// tests; stub them here as thin fakes exposing the same open() API so
// TransactionTable's own wiring (refs, click handlers) can still be verified.
const stubs = {
  CategoryDirectEditor: {
    name: 'CategoryDirectEditor',
    template: '<div />',
    methods: { open: vi.fn() },
  },
  TransactionEditor: {
    name: 'TransactionEditor',
    emits: ['changed'],
    template: '<div />',
    methods: { open: vi.fn() },
  },
  PartnerEditor: { name: 'PartnerEditor', template: '<div />', methods: { open: vi.fn() } },
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
          buildTransaction({
            partner: { type: 'member', id: 'member-uuid-5', cn: 'Max Mustermann' },
          }),
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
        { id: 'direct-uuid-1', p4x_category_id: 'category-uuid-1', amount: 4 },
        { id: 'direct-uuid-2', p4x_category_id: 'category-uuid-1', amount: 6 },
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
        buildFilter({ id: 'filter-uuid-1' }),
        buildFilter({ id: 'filter-uuid-2' }),
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
      props: { transactions: [buildTransaction({ id: '4', p4x_account_id: '2' })], categories },
      ...mountOpts,
    })

    // The raw-data icon lives inside the DataTable's row-expansion slot,
    // which only renders once the row has been expanded.
    await wrapper.find('.p-datatable-row-toggle-button').trigger('click')
    await wrapper.find('.pi-search').trigger('click')
    await flushPromises()

    expect(mockGetTransactionRaw).toHaveBeenCalledWith('2', '4')
    expect(document.querySelector('.raw-json')?.textContent).toContain('"foo": "bar"')
    wrapper.unmount()
  })

  describe('attachment download', () => {
    let downloads: string[]

    beforeEach(() => {
      downloads = []
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloads.push(this.download)
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    const mountWithAttachment = () =>
      mount(TransactionTable, {
        props: {
          transactions: [buildTransaction({ id: '4', p4x_account_id: '2', has_attachment: true })],
          categories,
        },
        ...mountOpts,
      })

    it('downloads the attachment under the name from the response header', async () => {
      mockGetTransactionAttachment.mockResolvedValue({
        data: new Blob(['x']),
        headers: { 'content-disposition': 'attachment; filename="Beilage_4.pdf"' },
      })
      const wrapper = mountWithAttachment()

      await wrapper.find('.pi-paperclip').trigger('click')
      await flushPromises()

      expect(mockGetTransactionAttachment).toHaveBeenCalledWith('2', '4')
      expect(downloads).toEqual(['Beilage_4.pdf'])
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock')
      wrapper.unmount()
    })

    it('falls back to a name built from the transaction id without a header', async () => {
      mockGetTransactionAttachment.mockResolvedValue({ data: new Blob(['x']), headers: {} })
      const wrapper = mountWithAttachment()

      await wrapper.find('.pi-paperclip').trigger('click')
      await flushPromises()

      expect(downloads).toEqual(['Beilage_4.pdf'])
      wrapper.unmount()
    })

    it('tells the user when the attachment cannot be downloaded', async () => {
      mockGetTransactionAttachment.mockRejectedValue(new Error('boom'))
      const wrapper = mountWithAttachment()

      await wrapper.find('.pi-paperclip').trigger('click')
      await flushPromises()

      expect(downloads).toEqual([])
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Anhang konnte nicht heruntergeladen werden.',
        }),
      )
      wrapper.unmount()
    })
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

  it('shows "intern" for a zero-amount transaction', () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction({ amount: 0 })], categories },
      ...mountOpts,
    })
    expect(wrapper.text()).toContain('intern')
    wrapper.unmount()
  })

  it('shows "Empfänger" for a negative-amount transaction', () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction({ amount: -5 })], categories },
      ...mountOpts,
    })
    expect(wrapper.text()).toContain('Empfänger')
    wrapper.unmount()
  })

  it('shows the single matching category filter without a warning', () => {
    const tx = buildTransaction({
      p4x_category_filters: [buildFilter({ id: 'filter-uuid-1' })],
    })
    const wrapper = mount(TransactionTable, {
      props: { transactions: [tx], categories },
      ...mountOpts,
    })
    expect(wrapper.text()).toContain('Spende')
    expect(wrapper.text()).not.toContain('Uneindeutige')
    wrapper.unmount()
  })

  it('shows the comment in the expanded row when set', async () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction({ comment: 'Bitte prüfen' })], categories },
      ...mountOpts,
    })
    await wrapper.find('.p-datatable-row-toggle-button').trigger('click')
    expect(wrapper.text()).toContain('Bitte prüfen')
    wrapper.unmount()
  })

  it('opens the partner editor for admins', async () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction()], categories, admin: true },
      ...mountOpts,
    })
    await wrapper.find('.p-datatable-row-toggle-button').trigger('click')
    await wrapper.find('.partner-edit-icon').trigger('click')
    await flushPromises()

    expect(stubs.PartnerEditor.methods.open).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('opens the category editor for admins', async () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction()], categories, admin: true },
      ...mountOpts,
    })
    await wrapper.find('.p-datatable-row-toggle-button').trigger('click')
    await wrapper.find('.category-edit-icon').trigger('click')
    await flushPromises()

    expect(stubs.CategoryDirectEditor.methods.open).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('opens the transaction editor via the admin-action link', async () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction()], categories, admin: true },
      ...mountOpts,
    })
    await wrapper.find('.p-datatable-row-toggle-button').trigger('click')
    await wrapper.find('.admin-action').trigger('click')
    await flushPromises()

    expect(stubs.TransactionEditor.methods.open).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('emits refresh when a sub-editor reports a change', async () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction()], categories, admin: true },
      ...mountOpts,
    })
    await wrapper.find('.p-datatable-row-toggle-button').trigger('click')
    await wrapper.find('.admin-action').trigger('click')
    await flushPromises()

    await wrapper.findComponent({ name: 'TransactionEditor' }).vm.$emit('changed')

    expect(wrapper.emitted('refresh')).toHaveLength(1)
    wrapper.unmount()
  })

  it('clears the raw data and tells the user when fetching it fails', async () => {
    mockGetTransactionRaw.mockRejectedValue(new Error('boom'))
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction({ id: '4', p4x_account_id: '2' })], categories },
      ...mountOpts,
    })
    await wrapper.find('.p-datatable-row-toggle-button').trigger('click')
    await wrapper.find('.pi-search').trigger('click')
    await flushPromises()

    expect(document.querySelector('.raw-json')).toBeNull()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Rohdaten konnten nicht geladen werden.',
      }),
    )
    wrapper.unmount()
  })

  it('jumps to the first and last page', async () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction()], categories, total: 50, perPage: 10, page: 2 },
      ...mountOpts,
    })
    const buttons = wrapper.findAll('.tx-pager button')
    await buttons[0]!.trigger('click') // first
    expect(wrapper.emitted('pageChange')?.[0]).toEqual([1])

    await buttons[3]!.trigger('click') // last
    expect(wrapper.emitted('pageChange')?.[1]).toEqual([5])
    wrapper.unmount()
  })

  describe('pagination', () => {
    it.each([
      [25, 10, 1, 'Seite 1 / 3', 'Transaktionen 1 bis 10'],
      [25, 10, 3, 'Seite 3 / 3', 'Transaktionen 21 bis 25'],
      [20, 10, 2, 'Seite 2 / 2', 'Transaktionen 11 bis 20'],
    ])(
      'shows %i transactions at %i per page on page %i as "%s" and "%s"',
      (total, perPage, page, pageLabel, rangeLabel) => {
        const wrapper = mount(TransactionTable, {
          props: { transactions: [buildTransaction()], categories, total, perPage, page },
          ...mountOpts,
        })

        expect(wrapper.find('.page-info').text()).toBe(pageLabel)
        expect(wrapper.find('.tx-range').text().replace(/\s+/g, ' ')).toBe(rangeLabel)
        wrapper.unmount()
      },
    )

    it('follows a changed total without being mounted again', async () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: [buildTransaction()], categories, total: 20, perPage: 10, page: 1 },
        ...mountOpts,
      })
      expect(wrapper.find('.page-info').text()).toBe('Seite 1 / 2')

      await wrapper.setProps({ total: 45 })

      expect(wrapper.find('.page-info').text()).toBe('Seite 1 / 5')
      wrapper.unmount()
    })
  })

  it('names the sender of a positive amount "Absender"', () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction({ amount: 7 })], categories },
      ...mountOpts,
    })

    expect(wrapper.find('.dir-positive').text()).toBe('Absender')
    wrapper.unmount()
  })

  it('shows the amount of a direct category only when the amount is split', () => {
    const tx = buildTransaction({
      p4x_category_directs: [
        { id: 'direct-uuid-1', p4x_category_id: 'category-uuid-1', amount: 10 },
      ],
    })
    const wrapper = mount(TransactionTable, {
      props: { transactions: [tx], categories },
      ...mountOpts,
    })

    expect(wrapper.find('.category-badges').text()).toContain('Spende')
    expect(wrapper.find('.category-badges').text()).not.toContain('(')
    wrapper.unmount()
  })

  it('shows no comment line in the expanded row without a comment', async () => {
    const wrapper = mount(TransactionTable, {
      props: { transactions: [buildTransaction({ comment: null })], categories },
      ...mountOpts,
    })
    await wrapper.find('.p-datatable-row-toggle-button').trigger('click')

    expect(wrapper.text()).not.toContain('Kommentar:')
    wrapper.unmount()
  })

  it('offers every row action as a real button with an accessible name', async () => {
    const wrapper = mount(TransactionTable, {
      props: {
        transactions: [buildTransaction({ has_attachment: true })],
        categories,
        admin: true,
      },
      ...mountOpts,
    })
    await wrapper.find('.p-datatable-row-toggle-button').trigger('click')

    const names = wrapper
      .findAll('button')
      .map((b) => b.attributes('aria-label') ?? b.text())
      .filter((name) => name !== '')
    expect(names).toEqual(
      expect.arrayContaining([
        'Anhang herunterladen',
        'Partner bearbeiten',
        'Kategorisierung bearbeiten',
        'Rohdaten anzeigen',
        'Kommentar und Anhang bearbeiten',
      ]),
    )
    wrapper.unmount()
  })
})
