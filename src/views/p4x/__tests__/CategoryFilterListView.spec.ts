import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CategoryFilterListView from '../CategoryFilterListView.vue'
import PrimeVue from 'primevue/config'
import type { CategoryFilter, P4xCategory } from '@/types/p4x'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockGetCategoryFilters = vi.fn()
const mockGetDashboard = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getCategoryFilters: (...args: unknown[]) => mockGetCategoryFilters(...args),
    getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
  },
}))

function buildFilter(overrides: Partial<CategoryFilter> = {}): CategoryFilter {
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

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

describe('CategoryFilterListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDashboard.mockResolvedValue({ data: { categories } })
  })

  it('loads and shows the filters with their hit count and category', async () => {
    mockGetCategoryFilters.mockResolvedValue({ data: [buildFilter()] })
    const wrapper = mount(CategoryFilterListView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Kategorie-Filter (1)')
    expect(wrapper.text()).toContain('Filter A')
    expect(wrapper.text()).toContain('4')
    wrapper.unmount()
  })

  it('navigates to the create-filter view', async () => {
    mockGetCategoryFilters.mockResolvedValue({ data: [] })
    const wrapper = mount(CategoryFilterListView, mountOpts)
    await flushPromises()

    const createBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Filter erstellen',
    )!
    createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-filter-new' })
    wrapper.unmount()
  })

  it('navigates to the transactions-by-filter view for the clicked filter row', async () => {
    mockGetCategoryFilters.mockResolvedValue({
      data: [buildFilter({ id: 9, p4x_account_id: 3 })],
    })
    const wrapper = mount(CategoryFilterListView, mountOpts)
    await flushPromises()

    await wrapper.find('.pi-info-circle').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({
      name: 'p4x-transactions-filter',
      params: { accountId: 3 },
      query: { filterId: 9 },
    })
    wrapper.unmount()
  })

  it('navigates to the edit view for the clicked filter row', async () => {
    mockGetCategoryFilters.mockResolvedValue({ data: [buildFilter({ id: 9 })] })
    const wrapper = mount(CategoryFilterListView, mountOpts)
    await flushPromises()

    await wrapper.find('.pi-pencil').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-filter-edit', params: { id: 9 } })
    wrapper.unmount()
  })

  it('navigates to the filter2direct view for the clicked filter row', async () => {
    mockGetCategoryFilters.mockResolvedValue({ data: [buildFilter({ id: 9 })] })
    const wrapper = mount(CategoryFilterListView, mountOpts)
    await flushPromises()

    await wrapper.find('.pi-hammer').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-filter2direct', params: { id: 9 } })
    wrapper.unmount()
  })
})
