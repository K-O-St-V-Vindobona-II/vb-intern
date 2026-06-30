import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SummaryFormView from '../SummaryFormView.vue'
import PrimeVue from 'primevue/config'

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockOrderSummary = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: { orderSummary: (...args: unknown[]) => mockOrderSummary(...args) },
}))

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

function isoMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

describe('SummaryFormView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('orders the summary for the default 12-month range and downloads it as a zip', async () => {
    mockOrderSummary.mockResolvedValue({ data: 'zip-bytes' })
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 12)
    const end = new Date(now.getFullYear(), now.getMonth() - 1)
    const expectedStart = isoMonth(start.getFullYear(), start.getMonth() + 1)
    const expectedEnd = isoMonth(end.getFullYear(), end.getMonth() + 1)

    const wrapper = mount(SummaryFormView, mountOpts)
    const button = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Auswertung bestellen',
    )!
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockOrderSummary).toHaveBeenCalledWith({ start: expectedStart, end: expectedEnd })
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')

    clickSpy.mockRestore()
    wrapper.unmount()
  })

  it('shows an error toast when ordering the summary fails', async () => {
    mockOrderSummary.mockRejectedValue({ response: { data: { detail: 'Zeitraum ungültig' } } })
    const wrapper = mount(SummaryFormView, mountOpts)

    const button = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Auswertung bestellen',
    )!
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Zeitraum ungültig' }),
    )
    wrapper.unmount()
  })
})
