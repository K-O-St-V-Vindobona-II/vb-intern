import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CategoryDirectEditor from '../CategoryDirectEditor.vue'
import PrimeVue from 'primevue/config'
import type { P4xTransaction, P4xCategory, CategoryFilterShort } from '@/types/p4x'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockConfirmRequire = vi.fn()
vi.mock('primevue/useconfirm', () => ({
  useConfirm: vi.fn(() => ({ require: mockConfirmRequire })),
}))

const mockSetCategoryDirect = vi.fn()
const mockUnsetCategoryDirect = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    setCategoryDirect: (...args: unknown[]) => mockSetCategoryDirect(...args),
    unsetCategoryDirect: (...args: unknown[]) => mockUnsetCategoryDirect(...args),
  },
}))

function buildTransaction(overrides: Partial<P4xTransaction> = {}): P4xTransaction {
  return {
    id: 'transaction-uuid-1',
    booking: '2026-06-01',
    valuation: '2026-06-01',
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

const categories: P4xCategory[] = [
  {
    id: 'category-uuid-1',
    name: 'spende',
    label: 'Spende',
    background_color: '#fff',
    text_color: '#000',
    protected: false,
  },
  {
    id: 'category-uuid-2',
    name: 'beitrag',
    label: 'Beitrag',
    background_color: '#fff',
    text_color: '#000',
    protected: false,
  },
]

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
    hitCount: 3,
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

function clickDialogButton(text: string) {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text)!
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

type SplitState = {
  form: {
    cat0: string | null
    amt0: number
    cat1: string | null
    amt1: number
    cat2: string | null
    amt2: number
  }
}

function saveButton(): HTMLButtonElement {
  return Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent === 'Speichern',
  ) as HTMLButtonElement
}

describe('CategoryDirectEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetCategoryDirect.mockResolvedValue({ data: buildTransaction() })
    mockUnsetCategoryDirect.mockResolvedValue({ data: buildTransaction() })
  })

  it('pre-fills the first slot from the transaction amount when no direct categorization exists', async () => {
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction({ amount: 25 }), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    expect(document.querySelector('.sum-row')?.textContent).toContain('25')
    wrapper.unmount()
  })

  it('shows a button to create a filter when no filters exist', async () => {
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction(), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    expect(
      Array.from(document.querySelectorAll('button')).some(
        (b) => b.textContent === 'Filter erstellen',
      ),
    ).toBe(true)
    wrapper.unmount()
  })

  it('navigates to filter creation with transaction data as query params', async () => {
    const tx = buildTransaction({ p4x_account_id: '3', iban: 'AT999', amount: 12, subject: 'Test' })
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: tx, categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const createBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Filter erstellen',
    )!
    createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(mockPush).toHaveBeenCalledWith({
      name: 'p4x-filter-new',
      query: { accountId: '3', iban: 'AT999', amount: 12, subject: 'Test' },
    })
    wrapper.unmount()
  })

  it('lists existing filters with hit count and toggles details', async () => {
    const tx = buildTransaction({
      p4x_category_filters: [buildFilter({ subject: 'Hallo', subject_mode: 'starts' })],
    })
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: tx, categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    expect(document.querySelector('.filter-table')?.textContent).toContain('3')
    expect(document.querySelector('.filter-table .category-badge')?.textContent).toContain('Spende')
    expect(document.querySelector('.filter-details')).toBeFalsy()

    const detailIcon = document.querySelector('.pi-info-circle') as HTMLElement
    detailIcon.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(document.querySelector('.filter-details')?.textContent).toContain('beginnt mit:')
    expect(document.querySelector('.filter-details .category-badge')?.textContent).toContain(
      'Spende',
    )
    wrapper.unmount()
  })

  it('navigates to filter edit and filter2direct from the icon row', async () => {
    const tx = buildTransaction({ p4x_category_filters: [buildFilter({ id: 'filter-uuid-7' })] })
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: tx, categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const editIcon = document.querySelector('.pi-pencil') as HTMLElement
    editIcon.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(mockPush).toHaveBeenCalledWith({
      name: 'p4x-filter-edit',
      params: { id: 'filter-uuid-7' },
    })

    const hammerIcon = document.querySelector('.pi-hammer') as HTMLElement
    hammerIcon.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(mockPush).toHaveBeenCalledWith({
      name: 'p4x-filter2direct',
      params: { id: 'filter-uuid-7' },
    })
    wrapper.unmount()
  })

  it('disables save while the sum of slots does not match the transaction amount', async () => {
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction({ amount: 10 }), categories },
      ...mountOpts,
    })
    const vm = wrapper.vm as unknown as { open: () => void }
    vm.open()
    await flushPromises()

    const form = (wrapper.vm as unknown as { form: { cat0: string | null; amt0: number } }).form
    form.cat0 = null
    form.amt0 = 4
    await flushPromises()

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )!
    expect(saveBtn.hasAttribute('disabled')).toBe(true)
    wrapper.unmount()
  })

  it('saves the direct categorization and emits changed', async () => {
    const updated = buildTransaction({
      id: 'transaction-uuid-5',
      p4x_category_directs: [
        { id: 'direct-uuid-1', p4x_category_id: 'category-uuid-1', amount: 10 },
      ],
    })
    mockSetCategoryDirect.mockResolvedValue({ data: updated })
    const wrapper = mount(CategoryDirectEditor, {
      props: {
        transaction: buildTransaction({ id: 'transaction-uuid-5', amount: 10 }),
        categories,
      },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const form = (wrapper.vm as unknown as { form: { cat0: string | null; amt0: number } }).form
    form.cat0 = 'category-uuid-1'
    await flushPromises()

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )!
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockSetCategoryDirect).toHaveBeenCalledWith('transaction-uuid-5', [
      { p4x_category_id: 'category-uuid-1', amount: 10 },
      { p4x_category_id: null, amount: 0 },
      { p4x_category_id: null, amount: 0 },
    ])
    expect(wrapper.emitted('changed')).toEqual([[updated]])
    wrapper.unmount()
  })

  it('asks for confirmation before deleting, and deletes nothing without accepting it', async () => {
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction({ id: 'transaction-uuid-5' }), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    clickDialogButton('Löschen')
    await flushPromises()

    expect(mockConfirmRequire).toHaveBeenCalledOnce()
    expect(mockUnsetCategoryDirect).not.toHaveBeenCalled()
    expect(wrapper.emitted('changed')).toBeUndefined()
    wrapper.unmount()
  })

  it('deletes the direct categorization and emits changed once the confirmation is accepted', async () => {
    const updated = buildTransaction({ id: 'transaction-uuid-5', p4x_category_directs: [] })
    mockUnsetCategoryDirect.mockResolvedValue({ data: updated })
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction({ id: 'transaction-uuid-5' }), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    clickDialogButton('Löschen')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockUnsetCategoryDirect).toHaveBeenCalledWith('transaction-uuid-5')
    expect(wrapper.emitted('changed')).toEqual([[updated]])
    wrapper.unmount()
  })

  it('shows the API error and keeps the dialog open when deleting fails', async () => {
    mockUnsetCategoryDirect.mockRejectedValue({ response: { data: { detail: 'Geschützt' } } })
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction(), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    clickDialogButton('Löschen')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Geschützt' }),
    )
    expect(wrapper.emitted('changed')).toBeUndefined()
    expect(document.querySelector('.sum-row')).toBeTruthy()
    wrapper.unmount()
  })

  it('shows the API error and keeps the dialog open when saving fails', async () => {
    mockSetCategoryDirect.mockRejectedValue({ response: { data: { detail: 'Ungültige Summe' } } })
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction({ amount: 10 }), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()
    const form = (wrapper.vm as unknown as { form: { cat0: string | null } }).form
    form.cat0 = 'category-uuid-1'
    await flushPromises()

    clickDialogButton('Speichern')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Ungültige Summe' }),
    )
    expect(wrapper.emitted('changed')).toBeUndefined()
    expect(document.querySelector('.sum-row')).toBeTruthy()
    wrapper.unmount()
  })

  it('disables save when slot 2 has an amount but no category', async () => {
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction({ amount: 10 }), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const form = (
      wrapper.vm as unknown as {
        form: { cat0: string | null; amt0: number; cat1: string | null; amt1: number }
      }
    ).form
    form.cat0 = 'category-uuid-1'
    form.amt0 = 5
    form.cat1 = null
    form.amt1 = 5
    await flushPromises()

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )!
    expect(saveBtn.hasAttribute('disabled')).toBe(true)
    wrapper.unmount()
  })

  it('disables save when slot 3 has an amount but no category', async () => {
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction({ amount: 10 }), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const form = (
      wrapper.vm as unknown as {
        form: { cat0: string | null; amt0: number; cat2: string | null; amt2: number }
      }
    ).form
    form.cat0 = 'category-uuid-1'
    form.amt0 = 5
    form.cat2 = null
    form.amt2 = 5
    await flushPromises()

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )!
    expect(saveBtn.hasAttribute('disabled')).toBe(true)
    wrapper.unmount()
  })

  it('disables save when a positive transaction has a negative slot amount', async () => {
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction({ amount: 10 }), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const form = (
      wrapper.vm as unknown as {
        form: { cat0: string | null; amt0: number; cat1: string | null; amt1: number }
      }
    ).form
    form.cat0 = 'category-uuid-1'
    form.amt0 = 15
    form.cat1 = 'category-uuid-2'
    form.amt1 = -5
    await flushPromises()

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )!
    expect(saveBtn.hasAttribute('disabled')).toBe(true)
    wrapper.unmount()
  })

  it('disables save when a negative transaction has a positive slot amount', async () => {
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction({ amount: -10 }), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const form = (
      wrapper.vm as unknown as {
        form: { cat0: string | null; amt0: number; cat1: string | null; amt1: number }
      }
    ).form
    form.cat0 = 'category-uuid-1'
    form.amt0 = -15
    form.cat1 = 'category-uuid-2'
    form.amt1 = 5
    await flushPromises()

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )!
    expect(saveBtn.hasAttribute('disabled')).toBe(true)
    wrapper.unmount()
  })

  it('enables save when the split across all three slots is valid', async () => {
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction({ amount: 10 }), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const form = (
      wrapper.vm as unknown as {
        form: {
          cat0: string | null
          amt0: number
          cat1: string | null
          amt1: number
          cat2: string | null
          amt2: number
        }
      }
    ).form
    form.cat0 = 'category-uuid-1'
    form.amt0 = 5
    form.cat1 = 'category-uuid-2'
    form.amt1 = 3
    form.cat2 = 'category-uuid-1'
    form.amt2 = 2
    await flushPromises()

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )!
    expect(saveBtn.hasAttribute('disabled')).toBe(false)
    wrapper.unmount()
  })

  it('closes the dialog without saving', async () => {
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction(), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const closeBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Schließen',
    )!
    closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockSetCategoryDirect).not.toHaveBeenCalled()
    expect(mockUnsetCategoryDirect).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  describe('the sum rule of the split', () => {
    it.each([
      [10, 4, 4, false],
      [10, 5, 4, false],
      [10, 5, 6, false],
      [10, 5, 5, true],
      [20.05, 10.02, 10.03, true],
      [0.3, 0.1, 0.2, true],
      [4.35, 2.17, 2.18, true],
      [1.1, 0.7, 0.4, true],
      [19.99, 9.99, 10, true],
      [20.05, 10.02, 10.04, false],
      [-20.05, -10.02, -10.03, true],
    ])(
      'a transaction of %d split into %d and %d may be saved: %s',
      async (amount, first, second, saveable) => {
        const wrapper = mount(CategoryDirectEditor, {
          props: { transaction: buildTransaction({ amount }), categories },
          ...mountOpts,
        })
        ;(wrapper.vm as unknown as { open: () => void }).open()
        await flushPromises()
        const { form } = wrapper.vm as unknown as SplitState
        form.cat0 = 'category-uuid-1'
        form.amt0 = first
        form.cat1 = 'category-uuid-2'
        form.amt1 = second
        await flushPromises()

        expect(saveButton().hasAttribute('disabled')).toBe(!saveable)
        wrapper.unmount()
      },
    )
  })

  describe('through the slot controls', () => {
    const openEditor = async (transaction: P4xTransaction) => {
      const wrapper = mount(CategoryDirectEditor, {
        props: { transaction, categories },
        ...mountOpts,
      })
      ;(wrapper.vm as unknown as { open: () => void }).open()
      await flushPromises()
      return wrapper
    }

    it('saves a split over three slots in the order of the slots', async () => {
      const wrapper = await openEditor(buildTransaction({ id: 'transaction-uuid-5', amount: 10 }))
      const selects = wrapper.findAllComponents({ name: 'Select' })
      const amounts = wrapper.findAllComponents({ name: 'FormAmount' })
      expect(selects).toHaveLength(3)
      expect(amounts).toHaveLength(3)

      await selects[0]!.vm.$emit('update:modelValue', 'category-uuid-1')
      await amounts[0]!.vm.$emit('update:modelValue', 5)
      await selects[1]!.vm.$emit('update:modelValue', 'category-uuid-2')
      await amounts[1]!.vm.$emit('update:modelValue', 3)
      await selects[2]!.vm.$emit('update:modelValue', 'category-uuid-1')
      await amounts[2]!.vm.$emit('update:modelValue', 2)
      await flushPromises()
      clickDialogButton('Speichern')
      await flushPromises()

      expect(mockSetCategoryDirect).toHaveBeenCalledWith('transaction-uuid-5', [
        { p4x_category_id: 'category-uuid-1', amount: 5 },
        { p4x_category_id: 'category-uuid-2', amount: 3 },
        { p4x_category_id: 'category-uuid-1', amount: 2 },
      ])
      wrapper.unmount()
    })

    it('shows the stored split in the three slots when opened, also for amounts sent as text', async () => {
      const wrapper = await openEditor(
        buildTransaction({
          amount: 10,
          p4x_category_directs: [
            { id: 'direct-uuid-1', p4x_category_id: 'category-uuid-1', amount: 5.5 },
            { id: 'direct-uuid-2', p4x_category_id: 'category-uuid-2', amount: '3.0' as never },
            { id: 'direct-uuid-3', p4x_category_id: 'category-uuid-1', amount: 1.5 },
          ],
        }),
      )

      const selects = wrapper.findAllComponents({ name: 'Select' })
      const amounts = wrapper.findAllComponents({ name: 'FormAmount' })
      expect(selects.map((s) => s.props('modelValue'))).toEqual([
        'category-uuid-1',
        'category-uuid-2',
        'category-uuid-1',
      ])
      expect(amounts.map((a) => a.props('modelValue'))).toEqual([5.5, 3, 1.5])
      expect(saveButton().hasAttribute('disabled')).toBe(false)
      wrapper.unmount()
    })

    it('closes the dialog after a successful save and after a successful delete', async () => {
      const wrapper = await openEditor(buildTransaction({ amount: 10 }))
      const selects = wrapper.findAllComponents({ name: 'Select' })
      await selects[0]!.vm.$emit('update:modelValue', 'category-uuid-1')
      await flushPromises()
      clickDialogButton('Speichern')
      await flushPromises()
      expect(document.querySelector('.p-dialog')).toBeNull()
      ;(wrapper.vm as unknown as { open: () => void }).open()
      await flushPromises()
      expect(document.querySelector('.p-dialog')).not.toBeNull()
      clickDialogButton('Löschen')
      await mockConfirmRequire.mock.calls[0]![0].accept()
      await flushPromises()
      expect(document.querySelector('.p-dialog')).toBeNull()
      wrapper.unmount()
    })

    it('closes the dialog when it leaves for a filter page', async () => {
      const tx = buildTransaction({ p4x_category_filters: [buildFilter()] })
      const wrapper = await openEditor(tx)

      ;(document.querySelector('.pi-pencil') as HTMLElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
      await flushPromises()

      expect(document.querySelector('.p-dialog')).toBeNull()
      wrapper.unmount()
    })

    it('closes the dialog when it leaves to create a filter', async () => {
      const wrapper = await openEditor(buildTransaction())

      clickDialogButton('Filter erstellen')
      await flushPromises()

      expect(document.querySelector('.p-dialog')).toBeNull()
      wrapper.unmount()
    })

    it('shows the amount limits and the counter-account IBAN of an opened filter', async () => {
      const tx = buildTransaction({
        p4x_category_filters: [
          buildFilter({ min_amount: 5, max_amount: 20, iban: 'AT611904300234573201' }),
        ],
      })
      const wrapper = await openEditor(tx)

      ;(document.querySelector('.pi-info-circle') as HTMLElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
      await flushPromises()

      const details = document.querySelector('.filter-details')!.textContent!.replace(/\s+/g, ' ')
      expect(details).toContain('Minimalbetrag:')
      expect(details).toMatch(/5,00/)
      expect(details).toContain('Maximalbetrag:')
      expect(details).toMatch(/20,00/)
      expect(details).toContain('IBAN (Gegenstelle): AT611904300234573201')
      wrapper.unmount()
    })
  })

  it('offers the categories sorted by name', async () => {
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction(), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const options = wrapper.findComponent({ name: 'Select' }).props('options') as Array<{
      label: string
    }>
    expect(options.map((o) => o.label)).toEqual(['beitrag (Beitrag)', 'spende (Spende)'])
    wrapper.unmount()
  })

  it('collapses the filter details again when the dialog is reopened', async () => {
    const tx = buildTransaction({ p4x_category_filters: [buildFilter({ subject: 'Hallo' })] })
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: tx, categories },
      ...mountOpts,
    })
    const vm = wrapper.vm as unknown as { open: () => void }
    vm.open()
    await flushPromises()
    ;(document.querySelector('.pi-info-circle') as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
    await flushPromises()
    expect(document.querySelector('.filter-details')).toBeTruthy()

    clickDialogButton('Schließen')
    await flushPromises()
    vm.open()
    await flushPromises()

    expect(document.querySelector('.filter-details')).toBeFalsy()
    wrapper.unmount()
  })

  it('makes the three filter actions real buttons with an accessible name', async () => {
    const tx = buildTransaction({ p4x_category_filters: [buildFilter()] })
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: tx, categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const buttons = Array.from(document.querySelectorAll('.filter-table button'))
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Details',
      'Filter bearbeiten',
      'Treffer zu Direktkategorisierung umwandeln',
    ])
    wrapper.unmount()
  })
})
