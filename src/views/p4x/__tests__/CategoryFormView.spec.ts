import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CategoryFormView from '../CategoryFormView.vue'
import PrimeVue from 'primevue/config'
import type { CategoryWithUsage } from '@/types/p4x'

const mockPush = vi.fn()
const mockRoute: { params: Record<string, string> } = { params: {} }
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockGetCategories = vi.fn()
const mockCreateCategory = vi.fn()
const mockUpdateCategory = vi.fn()
const mockDeleteCategory = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getCategories: (...args: unknown[]) => mockGetCategories(...args),
    createCategory: (...args: unknown[]) => mockCreateCategory(...args),
    updateCategory: (...args: unknown[]) => mockUpdateCategory(...args),
    deleteCategory: (...args: unknown[]) => mockDeleteCategory(...args),
  },
}))

function buildCategory(overrides: Partial<CategoryWithUsage> = {}): CategoryWithUsage {
  return {
    id: 1,
    name: 'spende',
    label: 'Spende',
    background_color: '#336600',
    text_color: '#ffffff',
    protected: false,
    used: { filter: 0, direct: 0 },
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

function clickButton(text: string) {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text)!
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('CategoryFormView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.params = {}
  })

  it('shows the create-mode title and an empty form when there is no id param', async () => {
    const wrapper = mount(CategoryFormView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Kategorie erstellen')
    expect(mockGetCategories).not.toHaveBeenCalled()
    expect(wrapper.find('.preview').exists()).toBe(false)
    wrapper.unmount()
  })

  it('does not show the delete button in create mode', async () => {
    const wrapper = mount(CategoryFormView, mountOpts)
    await flushPromises()

    expect(
      Array.from(document.querySelectorAll('button')).some((b) => b.textContent === 'Löschen'),
    ).toBe(false)
    wrapper.unmount()
  })

  it('loads the existing category in edit mode and pre-fills the form', async () => {
    mockRoute.params = { id: '1' }
    mockGetCategories.mockResolvedValue({
      data: [buildCategory(), buildCategory({ id: 2, label: 'Beitrag' })],
    })
    const wrapper = mount(CategoryFormView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Kategorie bearbeiten')
    expect(wrapper.find('.preview-badge').text()).toBe('Spende')
    wrapper.unmount()
  })

  it('creates a new category and navigates back on save', async () => {
    mockCreateCategory.mockResolvedValue({ data: buildCategory() })
    const wrapper = mount(CategoryFormView, mountOpts)
    await flushPromises()

    await wrapper.find('input').setValue('beitrag')

    clickButton('Speichern')
    await flushPromises()

    expect(mockCreateCategory).toHaveBeenCalledWith(expect.objectContaining({ name: 'beitrag' }))
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Kategorie erstellt' }),
    )
    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-categories' })
    wrapper.unmount()
  })

  it('updates an existing category and navigates back on save', async () => {
    mockRoute.params = { id: '1' }
    mockGetCategories.mockResolvedValue({ data: [buildCategory()] })
    mockUpdateCategory.mockResolvedValue({ data: buildCategory() })
    const wrapper = mount(CategoryFormView, mountOpts)
    await flushPromises()

    clickButton('Speichern')
    await flushPromises()

    expect(mockUpdateCategory).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'spende' }))
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Gespeichert' }),
    )
    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-categories' })
    wrapper.unmount()
  })

  it('shows an error toast and does not navigate when saving fails', async () => {
    mockCreateCategory.mockRejectedValue({
      response: { data: { detail: 'Name bereits vergeben' } },
    })
    const wrapper = mount(CategoryFormView, mountOpts)
    await flushPromises()

    clickButton('Speichern')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Name bereits vergeben' }),
    )
    expect(mockPush).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('deletes the category and navigates back', async () => {
    mockRoute.params = { id: '1' }
    mockGetCategories.mockResolvedValue({ data: [buildCategory()] })
    mockDeleteCategory.mockResolvedValue({ data: {} })
    const wrapper = mount(CategoryFormView, mountOpts)
    await flushPromises()

    clickButton('Löschen')
    await flushPromises()

    expect(mockDeleteCategory).toHaveBeenCalledWith(1)
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Gelöscht' }),
    )
    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-categories' })
    wrapper.unmount()
  })

  it('shows an error toast when deletion fails', async () => {
    mockRoute.params = { id: '1' }
    mockGetCategories.mockResolvedValue({ data: [buildCategory()] })
    mockDeleteCategory.mockRejectedValue({
      response: { data: { detail: 'Kategorie wird verwendet' } },
    })
    const wrapper = mount(CategoryFormView, mountOpts)
    await flushPromises()

    clickButton('Löschen')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Kategorie wird verwendet' }),
    )
    expect(mockPush).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('navigates back to the list without saving', async () => {
    const wrapper = mount(CategoryFormView, mountOpts)
    await flushPromises()

    clickButton('Zur Liste')

    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-categories' })
    expect(mockCreateCategory).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
