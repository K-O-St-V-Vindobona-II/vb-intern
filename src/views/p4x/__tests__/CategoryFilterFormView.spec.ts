import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CategoryFilterFormView from '../CategoryFilterFormView.vue'
import PrimeVue from 'primevue/config'
import type { CategoryFilter, P4xAccount, P4xCategory } from '@/types/p4x'

const mockPush = vi.fn()
const mockRoute: { params: Record<string, string>; query: Record<string, string> } = {
  params: {},
  query: {},
}
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
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

const mockGetDashboard = vi.fn()
const mockGetCategoryFilters = vi.fn()
const mockCreateCategoryFilter = vi.fn()
const mockUpdateCategoryFilter = vi.fn()
const mockDeleteCategoryFilter = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
    getCategoryFilters: (...args: unknown[]) => mockGetCategoryFilters(...args),
    createCategoryFilter: (...args: unknown[]) => mockCreateCategoryFilter(...args),
    updateCategoryFilter: (...args: unknown[]) => mockUpdateCategoryFilter(...args),
    deleteCategoryFilter: (...args: unknown[]) => mockDeleteCategoryFilter(...args),
  },
}))

function buildAccount(overrides: Partial<P4xAccount> = {}): P4xAccount {
  return {
    id: 'account-uuid-1',
    iban: 'AT001234',
    bic: null,
    label: 'Kasse Wien',
    init_date: '2020-01-01',
    init_balance: 0,
    balance: 100,
    transactions_count: 5,
    transactions_latest: '2026-06-01',
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

function buildFilter(overrides: Partial<CategoryFilter> = {}): CategoryFilter {
  return {
    id: '1',
    name: 'Filter A',
    p4x_account_id: 'account-uuid-1',
    account_id: 1,
    p4x_account_label: 'Kasse',
    iban: null,
    min_amount: null,
    max_amount: null,
    subject: null,
    subject_mode: 'equals',
    p4x_category_id: 'category-uuid-1',
    hitCount: 4,
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

function clickButton(text: string) {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text)!
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('CategoryFilterFormView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.params = {}
    mockRoute.query = {}
    mockGetDashboard.mockResolvedValue({ data: { accounts: [buildAccount()], categories } })
  })

  it('pre-fills the first account and category when creating without query params', async () => {
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Filter erstellen')
    expect(wrapper.findAllComponents({ name: 'Select' })[0]!.props('modelValue')).toBe(
      'account-uuid-1',
    )
    wrapper.unmount()
  })

  it('pre-fills iban, amount range and subject from query params when creating', async () => {
    mockRoute.query = { accountId: '1', iban: 'AT999', amount: '12', subject: 'Spende' }
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    const inputs = wrapper.findAll('input[type="text"]')
    expect(inputs[0]!.element.value).toBe('') // name field stays empty
    expect(wrapper.findComponent({ name: 'Checkbox' }).exists()).toBe(true)
    expect(wrapper.findAllComponents({ name: 'FormAmount' })).toHaveLength(2)
    wrapper.unmount()
  })

  it('loads and pre-fills an existing filter in edit mode', async () => {
    mockRoute.params = { id: '1' }
    mockGetCategoryFilters.mockResolvedValue({
      data: [buildFilter({ name: 'Bestandsfilter', min_amount: 5, max_amount: 20 })],
    })
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Filter bearbeiten')
    const nameInput = wrapper.find('input[type="text"]')
    expect((nameInput.element as HTMLInputElement).value).toBe('Bestandsfilter')
    expect(wrapper.findAllComponents({ name: 'FormAmount' })).toHaveLength(2)
    wrapper.unmount()
  })

  it('does not show the delete button in create mode', async () => {
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    expect(
      Array.from(document.querySelectorAll('button')).some((b) => b.textContent === 'Löschen'),
    ).toBe(false)
    wrapper.unmount()
  })

  it('creates a new filter with null min/max when the checkboxes are unchecked', async () => {
    mockCreateCategoryFilter.mockResolvedValue({ data: buildFilter() })
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    await wrapper.find('input[type="text"]').setValue('Neuer Filter')
    clickButton('Speichern')
    await flushPromises()

    expect(mockCreateCategoryFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Neuer Filter',
        min_amount: null,
        max_amount: null,
        iban: null,
        subject: null,
      }),
    )
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Filter erstellt' }),
    )
    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-filters' })
    wrapper.unmount()
  })

  it('includes the min/max amount when their checkboxes are checked', async () => {
    mockRoute.query = { amount: '15' }
    mockCreateCategoryFilter.mockResolvedValue({ data: buildFilter() })
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    clickButton('Speichern')
    await flushPromises()

    expect(mockCreateCategoryFilter).toHaveBeenCalledWith(
      expect.objectContaining({ min_amount: 15, max_amount: 15 }),
    )
    wrapper.unmount()
  })

  it('updates an existing filter and navigates back', async () => {
    mockRoute.params = { id: '1' }
    mockGetCategoryFilters.mockResolvedValue({ data: [buildFilter()] })
    mockUpdateCategoryFilter.mockResolvedValue({ data: buildFilter() })
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    clickButton('Speichern')
    await flushPromises()

    expect(mockUpdateCategoryFilter).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ name: 'Filter A' }),
    )
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Gespeichert' }),
    )
    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-filters' })
    wrapper.unmount()
  })

  it('shows an error toast and does not navigate when saving fails', async () => {
    mockCreateCategoryFilter.mockRejectedValue({ response: { data: { detail: 'Ungültig' } } })
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    clickButton('Speichern')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Ungültig' }),
    )
    expect(mockPush).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('asks for confirmation before deleting, and does not delete without accepting it', async () => {
    mockRoute.params = { id: '1' }
    mockGetCategoryFilters.mockResolvedValue({ data: [buildFilter()] })
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    clickButton('Löschen')

    expect(mockConfirmRequire).toHaveBeenCalledOnce()
    expect(mockConfirmRequire.mock.calls[0]![0].message).toContain('Filter A')
    expect(mockDeleteCategoryFilter).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('deletes the filter and navigates back once the confirmation is accepted', async () => {
    mockRoute.params = { id: '1' }
    mockGetCategoryFilters.mockResolvedValue({ data: [buildFilter()] })
    mockDeleteCategoryFilter.mockResolvedValue({ data: {} })
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    clickButton('Löschen')
    await mockConfirmRequire.mock.calls[0]![0].accept()

    expect(mockDeleteCategoryFilter).toHaveBeenCalledWith('1')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Gelöscht' }),
    )
    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-filters' })
    wrapper.unmount()
  })

  it('shows an error toast when deletion fails', async () => {
    mockRoute.params = { id: '1' }
    mockGetCategoryFilters.mockResolvedValue({ data: [buildFilter()] })
    mockDeleteCategoryFilter.mockRejectedValue({ response: { data: { detail: 'Wird verwendet' } } })
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    clickButton('Löschen')
    await mockConfirmRequire.mock.calls[0]![0].accept()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Wird verwendet' }),
    )
    expect(mockPush).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('navigates back to the list without saving', async () => {
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    clickButton('Zur Liste')

    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-filters' })
    expect(mockCreateCategoryFilter).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows a retry state instead of a silently empty form when loading fails', async () => {
    mockGetDashboard
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ data: { accounts: [buildAccount()], categories } })
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Das Formular konnte nicht geladen werden.')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Speichern')).toBe(false)
    const retry = wrapper.findAll('button').find((b) => b.text() === 'Erneut versuchen')
    expect(retry).toBeDefined()

    await retry!.trigger('click')
    await flushPromises()

    expect(mockGetDashboard).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('konnte nicht geladen werden')
    expect(wrapper.text()).toContain('Filter erstellen')
    wrapper.unmount()
  })

  it('shows the retry state in edit mode when the filter is not in the list', async () => {
    mockRoute.params = { id: '999' }
    mockGetCategoryFilters.mockResolvedValue({ data: [] })
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Das Formular konnte nicht geladen werden.')
    expect(wrapper.text()).not.toContain('Filter bearbeiten')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Speichern')).toBe(false)
    wrapper.unmount()
  })

  it('shows the same retry state in edit mode when the filter list cannot be loaded', async () => {
    mockRoute.params = { id: '1' }
    mockGetCategoryFilters.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(CategoryFilterFormView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Das Formular konnte nicht geladen werden.')
    expect(wrapper.find('input').exists()).toBe(false)
    wrapper.unmount()
  })
})
