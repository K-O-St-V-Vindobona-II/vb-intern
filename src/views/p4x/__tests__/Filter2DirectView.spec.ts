import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Filter2DirectView from '../Filter2DirectView.vue'
import PrimeVue from 'primevue/config'
import type { CategoryFilter, P4xCategory, FilterHit } from '@/types/p4x'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ params: { id: '7' } })),
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

const mockGetFilter2DirectPreview = vi.fn()
const mockProcessFilter2Direct = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getFilter2DirectPreview: (...args: unknown[]) => mockGetFilter2DirectPreview(...args),
    processFilter2Direct: (...args: unknown[]) => mockProcessFilter2Direct(...args),
  },
}))

function buildFilter(overrides: Partial<CategoryFilter> = {}): CategoryFilter {
  return {
    id: '7',
    name: 'Filter A',
    p4x_account_id: '1',
    p4x_account_label: 'Kasse',
    iban: null,
    min_amount: null,
    max_amount: null,
    subject: null,
    subject_mode: 'equals',
    p4x_category_id: 'category-uuid-1',
    hitCount: 2,
    ...overrides,
  }
}

const category: P4xCategory = {
  id: 'category-uuid-1',
  name: 'spende',
  label: 'Spende',
  background_color: '#fff',
  text_color: '#000',
  protected: false,
}

function buildHit(overrides: Partial<FilterHit> = {}): FilterHit {
  return { booking: '2026-06-01', amount: 10, subject: 'Spende', iban: 'AT001234', ...overrides }
}

function buildPreview(overrides: Record<string, unknown> = {}) {
  return {
    warningsCount: 0,
    filter: buildFilter(),
    category,
    hits: [buildHit()],
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

function clickConvertButton() {
  const convertBtn = Array.from(document.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('umwandeln'),
  )!
  convertBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('Filter2DirectView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the filter, category and hits on mount', async () => {
    mockGetFilter2DirectPreview.mockResolvedValue({ data: buildPreview() })
    const wrapper = mount(Filter2DirectView, mountOpts)
    await flushPromises()

    expect(mockGetFilter2DirectPreview).toHaveBeenCalledWith('7')
    expect(wrapper.text()).toContain('Filter A')
    expect(wrapper.text()).toContain('Spende')
    wrapper.unmount()
  })

  it('shows a warning box and hides the conversion button when there are open warnings', async () => {
    mockGetFilter2DirectPreview.mockResolvedValue({ data: buildPreview({ warningsCount: 2 }) })
    const wrapper = mount(Filter2DirectView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.warning-box').exists()).toBe(true)
    expect(wrapper.text()).toContain('2 offene Warnungen')
    expect(
      Array.from(document.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('umwandeln'),
      ),
    ).toBe(false)
    wrapper.unmount()
  })

  it('shows the conversion button with the hit count when there are no warnings', async () => {
    mockGetFilter2DirectPreview.mockResolvedValue({
      data: buildPreview({ hits: [buildHit(), buildHit()] }),
    })
    const wrapper = mount(Filter2DirectView, mountOpts)
    await flushPromises()

    const convertBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('umwandeln'),
    )
    expect(convertBtn?.textContent).toContain('2 Filter-Treffer')
    wrapper.unmount()
  })

  it('shows the empty state when there are no hits', async () => {
    mockGetFilter2DirectPreview.mockResolvedValue({ data: buildPreview({ hits: [] }) })
    const wrapper = mount(Filter2DirectView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.empty').exists()).toBe(true)
    expect(wrapper.find('.hits-section').exists()).toBe(false)
    wrapper.unmount()
  })

  it('asks for confirmation naming the hit count and the category, and converts nothing before it is accepted', async () => {
    mockGetFilter2DirectPreview.mockResolvedValue({
      data: buildPreview({ hits: [buildHit(), buildHit()] }),
    })
    const wrapper = mount(Filter2DirectView, mountOpts)
    await flushPromises()

    clickConvertButton()
    await flushPromises()

    expect(mockConfirmRequire).toHaveBeenCalledOnce()
    expect(mockConfirmRequire.mock.calls[0]![0].message).toContain('2 Transaktionen werden')
    expect(mockConfirmRequire.mock.calls[0]![0].message).toContain('"Spende"')
    expect(mockProcessFilter2Direct).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('uses the singular in the confirmation for a single hit', async () => {
    mockGetFilter2DirectPreview.mockResolvedValue({ data: buildPreview() })
    const wrapper = mount(Filter2DirectView, mountOpts)
    await flushPromises()

    clickConvertButton()

    expect(mockConfirmRequire.mock.calls[0]![0].message).toContain('1 Transaktion wird')
    wrapper.unmount()
  })

  it('processes the conversion and shows a success toast once the confirmation is accepted', async () => {
    mockGetFilter2DirectPreview.mockResolvedValue({ data: buildPreview() })
    mockProcessFilter2Direct.mockResolvedValue({ data: { hits: [] } })
    const wrapper = mount(Filter2DirectView, mountOpts)
    await flushPromises()

    clickConvertButton()
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockProcessFilter2Direct).toHaveBeenCalledWith('7')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Konvertierung abgeschlossen' }),
    )
    expect(wrapper.find('.empty').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows the API error text in a toast when the conversion fails', async () => {
    mockGetFilter2DirectPreview.mockResolvedValue({ data: buildPreview() })
    mockProcessFilter2Direct.mockRejectedValue({ response: { data: { detail: 'Fehlgeschlagen' } } })
    const wrapper = mount(Filter2DirectView, mountOpts)
    await flushPromises()

    clickConvertButton()
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Fehlgeschlagen' }),
    )
    wrapper.unmount()
  })

  it.each([
    ['equals', 'Betreff ist gleich:'],
    ['contains', 'Betreff enthält:'],
    ['starts', 'Betreff beginnt mit:'],
  ])('describes the subject condition "%s" as "%s"', async (mode, label) => {
    mockGetFilter2DirectPreview.mockResolvedValue({
      data: buildPreview({ filter: buildFilter({ subject: 'Spende', subject_mode: mode }) }),
    })
    const wrapper = mount(Filter2DirectView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.filter-details').text()).toContain(label)
    wrapper.unmount()
  })

  it('navigates back to the filter list', async () => {
    mockGetFilter2DirectPreview.mockResolvedValue({ data: buildPreview() })
    const wrapper = mount(Filter2DirectView, mountOpts)
    await flushPromises()

    const backBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Zur Liste',
    )!
    backBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-filters' })
    wrapper.unmount()
  })

  it('shows a retry state instead of a silently empty page when loading fails, and recovers on retry', async () => {
    mockGetFilter2DirectPreview.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(Filter2DirectView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Die Daten konnten nicht geladen werden.')
    expect(wrapper.find('.filter-card').exists()).toBe(false)
    const retryBtn = wrapper.findAll('button').find((b) => b.text() === 'Erneut versuchen')
    expect(retryBtn).toBeDefined()

    mockGetFilter2DirectPreview.mockResolvedValueOnce({ data: buildPreview() })
    await retryBtn!.trigger('click')
    await flushPromises()

    expect(mockGetFilter2DirectPreview).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('konnten nicht geladen werden')
    expect(wrapper.find('.filter-card').exists()).toBe(true)
    wrapper.unmount()
  })
})
