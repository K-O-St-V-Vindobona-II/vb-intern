import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PaymentInfoView from '../PaymentInfoView.vue'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'

const mockGet = vi.fn()
vi.mock('@/services/api', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockWriteText = vi.fn().mockResolvedValue(undefined)
Object.assign(navigator, { clipboard: { writeText: mockWriteText } })

function buildEntry(overrides: Record<string, string> = {}) {
  return {
    title: 'Vereinskonto',
    name: 'K.Ö.St.V. Vindobona II',
    iban: 'AT001234567890',
    bic: 'GIBAATWWXXX',
    fee: '10,00 € / Monat',
    ...overrides,
  }
}

const mountOpts = {
  global: { plugins: [PrimeVue], directives: { tooltip: Tooltip } },
  attachTo: document.body,
}

describe('PaymentInfoView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and shows the payment info cards', async () => {
    mockGet.mockResolvedValue({ data: [buildEntry()] })
    const wrapper = mount(PaymentInfoView, mountOpts)
    await flushPromises()

    expect(mockGet).toHaveBeenCalledWith('/information/payment')
    expect(wrapper.text()).toContain('Vereinskonto')
    expect(wrapper.text()).toContain('AT001234567890')
    expect(wrapper.text()).toContain('10,00 € / Monat')
    wrapper.unmount()
  })

  it('does not show any card before loading finishes', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(PaymentInfoView, mountOpts)

    expect(wrapper.find('.payment-page').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders one card per entry', async () => {
    mockGet.mockResolvedValue({
      data: [buildEntry(), buildEntry({ title: 'Spendenkonto', iban: 'AT009999999999' })],
    })
    const wrapper = mount(PaymentInfoView, mountOpts)
    await flushPromises()

    expect(wrapper.findAll('.payment-card')).toHaveLength(2)
    wrapper.unmount()
  })

  it('copies the IBAN to the clipboard and shows a toast', async () => {
    mockGet.mockResolvedValue({ data: [buildEntry()] })
    const wrapper = mount(PaymentInfoView, mountOpts)
    await flushPromises()

    const copyIcons = wrapper.findAll('.copy-btn')
    await copyIcons[0]!.trigger('click')
    await flushPromises()

    expect(mockWriteText).toHaveBeenCalledWith('AT001234567890')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', detail: 'AT001234567890' }),
    )
    wrapper.unmount()
  })

  it('copies the BIC to the clipboard', async () => {
    mockGet.mockResolvedValue({ data: [buildEntry()] })
    const wrapper = mount(PaymentInfoView, mountOpts)
    await flushPromises()

    const copyIcons = wrapper.findAll('.copy-btn')
    await copyIcons[1]!.trigger('click')
    await flushPromises()

    expect(mockWriteText).toHaveBeenCalledWith('GIBAATWWXXX')
    wrapper.unmount()
  })
})
