import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
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

const createObjectURL = vi.fn((_blob: Blob) => 'blob:mock')
const revokeObjectURL = vi.fn()
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

beforeAll(() => {
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL
})

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
})

function orderButton(): HTMLButtonElement {
  return Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent === 'Auswertung bestellen',
  ) as HTMLButtonElement
}

describe('SummaryFormView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('orders the summary for the default 12-month range and downloads it as a zip', async () => {
    mockOrderSummary.mockResolvedValue({ data: new Blob(['zip-bytes']), headers: {} })
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

  it('saves the zip under the range in its name', async () => {
    mockOrderSummary.mockResolvedValue({ data: new Blob(['zip-bytes']), headers: {} })
    const downloads: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download)
    })
    const wrapper = mount(SummaryFormView, mountOpts)
    const pickers = wrapper.findAllComponents({ name: 'DatePicker' })
    await pickers[0]!.vm.$emit('update:modelValue', new Date(2025, 0, 1))
    await pickers[1]!.vm.$emit('update:modelValue', new Date(2025, 5, 1))

    orderButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(downloads).toEqual(['Abrechnung_2025-01-01_bis_2025-06-01.zip'])
    wrapper.unmount()
  })

  it('refuses a range that starts after it ends and says why', async () => {
    const wrapper = mount(SummaryFormView, mountOpts)
    const pickers = wrapper.findAllComponents({ name: 'DatePicker' })
    await pickers[0]!.vm.$emit('update:modelValue', new Date(2025, 6, 1))
    await pickers[1]!.vm.$emit('update:modelValue', new Date(2025, 2, 1))
    await flushPromises()

    expect(wrapper.text()).toContain('Das Startdatum darf nicht nach dem Enddatum liegen.')
    expect(orderButton().hasAttribute('disabled')).toBe(true)
    orderButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(mockOrderSummary).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('names both month pickers through their labels', async () => {
    const wrapper = mount(SummaryFormView, mountOpts)

    const labels = wrapper.findAll('label').map((l) => l.attributes('for'))
    const inputs = wrapper.findAll('input').map((i) => i.attributes('id'))
    expect(labels).toEqual(['summary-start', 'summary-end'])
    expect(inputs).toEqual(labels)
    wrapper.unmount()
  })

  it('lets the pickers go up to the current month only', async () => {
    const wrapper = mount(SummaryFormView, mountOpts)

    const limits = wrapper
      .findAllComponents({ name: 'DatePicker' })
      .map((p) => (p.props('maxDate') as Date).toDateString())
    expect(limits).toEqual([new Date().toDateString(), new Date().toDateString()])
    wrapper.unmount()
  })
})
