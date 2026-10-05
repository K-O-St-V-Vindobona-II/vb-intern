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

  it('shows name, IBAN, BIC and fee of every entry in their own places', async () => {
    mockGet.mockResolvedValue({ data: [buildEntry()] })
    const wrapper = mount(PaymentInfoView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.card-name').text()).toBe('K.Ö.St.V. Vindobona II')
    const values = wrapper.findAll('.detail-value').map((v) => v.text())
    expect(values).toEqual(['AT001234567890', 'GIBAATWWXXX'])
    expect(wrapper.find('.card-fee').text()).toBe('10,00 € / Monat')
    wrapper.unmount()
  })

  it('reports the copied value in a toast titled "Kopiert"', async () => {
    mockGet.mockResolvedValue({ data: [buildEntry()] })
    const wrapper = mount(PaymentInfoView, mountOpts)
    await flushPromises()

    await wrapper.findAll('.copy-btn')[1]!.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Kopiert', detail: 'GIBAATWWXXX' }),
    )
    wrapper.unmount()
  })

  it('says so when the clipboard cannot be written', async () => {
    mockGet.mockResolvedValue({ data: [buildEntry()] })
    mockWriteText.mockRejectedValueOnce(new Error('denied'))
    const wrapper = mount(PaymentInfoView, mountOpts)
    await flushPromises()

    await wrapper.findAll('.copy-btn')[0]!.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'Kopieren nicht möglich',
        detail: 'Bitte den Wert markieren und von Hand kopieren.',
      }),
    )
    expect(mockToastAdd).not.toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
    wrapper.unmount()
  })

  it('shows a retry state instead of an empty page when loading fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(PaymentInfoView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.payment-card').exists()).toBe(false)
    expect(wrapper.find('h2').text()).toBe('Information')
    const retry = wrapper.findAll('button').find((b) => b.text() === 'Erneut versuchen')!

    mockGet.mockResolvedValueOnce({ data: [buildEntry()] })
    await retry.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.payment-card')).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows neither the error nor empty cards while a retry is running', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(PaymentInfoView, mountOpts)
    await flushPromises()
    const retry = wrapper.findAll('button').find((b) => b.text() === 'Erneut versuchen')!

    mockGet.mockReturnValueOnce(new Promise(() => {}))
    await retry.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('konnte nicht geladen werden')
    expect(wrapper.find('.payment-page').exists()).toBe(false)
    wrapper.unmount()
  })

  it('offers the two copy actions as buttons with a name', async () => {
    mockGet.mockResolvedValue({ data: [buildEntry()] })
    const wrapper = mount(PaymentInfoView, mountOpts)
    await flushPromises()

    const names = wrapper.findAll('button.copy-btn').map((b) => b.attributes('aria-label'))
    expect(names).toEqual(['IBAN kopieren', 'BIC kopieren'])
    wrapper.unmount()
  })
})
