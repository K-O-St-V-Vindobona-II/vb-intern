import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CategoryDirectEditor from '../CategoryDirectEditor.vue'
import PrimeVue from 'primevue/config'
import type { P4xTransaction, P4xCategory, CategoryFilterShort } from '@/types/p4x'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
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
    id: 1,
    booking: '2026-06-01',
    valuation: '2026-06-01',
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
  {
    id: 2,
    name: 'beitrag',
    label: 'Beitrag',
    background_color: '#fff',
    text_color: '#000',
    protected: false,
  },
]

function buildFilter(overrides: Partial<CategoryFilterShort> = {}): CategoryFilterShort {
  return {
    id: 1,
    name: 'Filter A',
    p4x_account_id: 1,
    p4x_account_label: 'Kasse',
    iban: null,
    min_amount: null,
    max_amount: null,
    subject: null,
    subject_mode: 'equals',
    p4x_category_id: 1,
    hitCount: 3,
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

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
    const tx = buildTransaction({ p4x_account_id: 3, iban: 'AT999', amount: 12, subject: 'Test' })
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
      query: { accountId: 3, iban: 'AT999', amount: 12, subject: 'Test' },
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
    expect(document.querySelector('.filter-details')).toBeFalsy()

    const detailIcon = document.querySelector('.pi-info-circle') as HTMLElement
    detailIcon.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(document.querySelector('.filter-details')?.textContent).toContain('beginnt mit:')
    wrapper.unmount()
  })

  it('navigates to filter edit and filter2direct from the icon row', async () => {
    const tx = buildTransaction({ p4x_category_filters: [buildFilter({ id: 7 })] })
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: tx, categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const editIcon = document.querySelector('.pi-pencil') as HTMLElement
    editIcon.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-filter-edit', params: { id: 7 } })

    const hammerIcon = document.querySelector('.pi-hammer') as HTMLElement
    hammerIcon.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-filter2direct', params: { id: 7 } })
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

    const form = (wrapper.vm as unknown as { form: { cat0: number | null; amt0: number } }).form
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
      id: 5,
      p4x_category_directs: [{ id: 1, p4x_category_id: 1, amount: 10 }],
    })
    mockSetCategoryDirect.mockResolvedValue({ data: updated })
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction({ id: 5, amount: 10 }), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const form = (wrapper.vm as unknown as { form: { cat0: number | null; amt0: number } }).form
    form.cat0 = 1
    await flushPromises()

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )!
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockSetCategoryDirect).toHaveBeenCalledWith(5, [
      { p4x_category_id: 1, amount: 10 },
      { p4x_category_id: null, amount: 0 },
      { p4x_category_id: null, amount: 0 },
    ])
    expect(wrapper.emitted('changed')).toEqual([[updated]])
    wrapper.unmount()
  })

  it('deletes the direct categorization and emits changed', async () => {
    const updated = buildTransaction({ id: 5, p4x_category_directs: [] })
    mockUnsetCategoryDirect.mockResolvedValue({ data: updated })
    const wrapper = mount(CategoryDirectEditor, {
      props: { transaction: buildTransaction({ id: 5 }), categories },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const deleteBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Löschen',
    )!
    deleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockUnsetCategoryDirect).toHaveBeenCalledWith(5)
    expect(wrapper.emitted('changed')).toEqual([[updated]])
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
        form: { cat0: number | null; amt0: number; cat1: number | null; amt1: number }
      }
    ).form
    form.cat0 = 1
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
        form: { cat0: number | null; amt0: number; cat2: number | null; amt2: number }
      }
    ).form
    form.cat0 = 1
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
        form: { cat0: number | null; amt0: number; cat1: number | null; amt1: number }
      }
    ).form
    form.cat0 = 1
    form.amt0 = 15
    form.cat1 = 2
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
        form: { cat0: number | null; amt0: number; cat1: number | null; amt1: number }
      }
    ).form
    form.cat0 = 1
    form.amt0 = -15
    form.cat1 = 2
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
          cat0: number | null
          amt0: number
          cat1: number | null
          amt1: number
          cat2: number | null
          amt2: number
        }
      }
    ).form
    form.cat0 = 1
    form.amt0 = 5
    form.cat1 = 2
    form.amt1 = 3
    form.cat2 = 1
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
})
