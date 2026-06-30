import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CategoryListView from '../CategoryListView.vue'
import PrimeVue from 'primevue/config'
import type { CategoryWithUsage } from '@/types/p4x'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockGetCategories = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: { getCategories: (...args: unknown[]) => mockGetCategories(...args) },
}))

function buildCategory(overrides: Partial<CategoryWithUsage> = {}): CategoryWithUsage {
  return {
    id: 1,
    name: 'spende',
    label: 'Spende',
    background_color: '#fff',
    text_color: '#000',
    protected: false,
    used: { filter: 2, direct: 5 },
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

describe('CategoryListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and shows the categories with their usage counts', async () => {
    mockGetCategories.mockResolvedValue({ data: [buildCategory()] })
    const wrapper = mount(CategoryListView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Kategorien (1)')
    expect(wrapper.text()).toContain('spende')
    expect(wrapper.text()).toContain('2 / 5')
    wrapper.unmount()
  })

  it('navigates to the create-category view', async () => {
    mockGetCategories.mockResolvedValue({ data: [] })
    const wrapper = mount(CategoryListView, mountOpts)
    await flushPromises()

    const createBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Kategorie erstellen',
    )!
    createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-category-new' })
    wrapper.unmount()
  })

  it('navigates to the edit view for the clicked category row', async () => {
    mockGetCategories.mockResolvedValue({ data: [buildCategory({ id: 7 })] })
    const wrapper = mount(CategoryListView, mountOpts)
    await flushPromises()

    await wrapper.find('.pi-pencil').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-category-edit', params: { id: 7 } })
    wrapper.unmount()
  })
})
