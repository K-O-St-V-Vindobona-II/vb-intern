import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import FeeConfigView from '../FeeConfigView.vue'
import PrimeVue from 'primevue/config'
import type { P4xFee } from '@/types/p4x'

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockGetFeeConfig = vi.fn()
const mockCreateFee = vi.fn()
const mockDeleteFee = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getFeeConfig: (...args: unknown[]) => mockGetFeeConfig(...args),
    createFee: (...args: unknown[]) => mockCreateFee(...args),
    deleteFee: (...args: unknown[]) => mockDeleteFee(...args),
  },
}))

function buildFee(overrides: Partial<P4xFee> = {}): P4xFee {
  return { start: '2026-01-01', fee: 5, protected: false, ...overrides }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

function clickButton(text: string) {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text)!
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('FeeConfigView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and shows the configured fees', async () => {
    mockGetFeeConfig.mockResolvedValue({ data: [buildFee()] })
    const wrapper = mount(FeeConfigView, mountOpts)
    await flushPromises()

    expect(wrapper.findAll('.fee-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('Jänner 2026')
    wrapper.unmount()
  })

  it('shows a disabled trash icon for protected entries and a clickable one otherwise', async () => {
    mockGetFeeConfig.mockResolvedValue({
      data: [buildFee({ protected: true }), buildFee({ start: '2026-02-01' })],
    })
    const wrapper = mount(FeeConfigView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.disabled-icon').exists()).toBe(true)
    expect(wrapper.find('.clickable').exists()).toBe(true)
    wrapper.unmount()
  })

  it('deletes a fee entry and shows a success toast', async () => {
    mockGetFeeConfig.mockResolvedValue({ data: [buildFee()] })
    mockDeleteFee.mockResolvedValue({ data: [] })
    const wrapper = mount(FeeConfigView, mountOpts)
    await flushPromises()

    await wrapper.find('.clickable').trigger('click')
    await flushPromises()

    expect(mockDeleteFee).toHaveBeenCalledWith('2026-01-01')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Eintrag entfernt' }),
    )
    expect(wrapper.findAll('.fee-row')).toHaveLength(0)
    wrapper.unmount()
  })

  it('shows an error toast when deletion fails', async () => {
    mockGetFeeConfig.mockResolvedValue({ data: [buildFee()] })
    mockDeleteFee.mockRejectedValue({ response: { data: { detail: 'Geschützt' } } })
    const wrapper = mount(FeeConfigView, mountOpts)
    await flushPromises()

    await wrapper.find('.clickable').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Geschützt' }),
    )
    wrapper.unmount()
  })

  it('opens the dialog and creates a new fee entry on save', async () => {
    mockGetFeeConfig.mockResolvedValue({ data: [] })
    mockCreateFee.mockResolvedValue({ data: [buildFee({ fee: 7 })] })
    const wrapper = mount(FeeConfigView, mountOpts)
    await flushPromises()

    clickButton('hinzufügen')
    await flushPromises()
    expect(document.querySelector('.dialog-field')).toBeTruthy()

    await wrapper.findComponent({ name: 'FormAmount' }).vm.$emit('update:modelValue', 7)
    clickButton('Speichern')
    await flushPromises()

    expect(mockCreateFee).toHaveBeenCalledWith(expect.objectContaining({ fee: 7 }))
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Eintrag hinzugefügt' }),
    )
    expect(wrapper.text()).toContain('Jänner 2026')
    wrapper.unmount()
  })

  it('shows an error toast when creating a fee entry fails', async () => {
    mockGetFeeConfig.mockResolvedValue({ data: [] })
    mockCreateFee.mockRejectedValue({ response: { data: { detail: 'Ungültiger Betrag' } } })
    const wrapper = mount(FeeConfigView, mountOpts)
    await flushPromises()

    clickButton('hinzufügen')
    await flushPromises()
    clickButton('Speichern')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Ungültiger Betrag' }),
    )
    wrapper.unmount()
  })

  it('closes the dialog via the cancel button without saving', async () => {
    mockGetFeeConfig.mockResolvedValue({ data: [] })
    const wrapper = mount(FeeConfigView, mountOpts)
    await flushPromises()

    clickButton('hinzufügen')
    await flushPromises()
    clickButton('Abbrechen')
    await flushPromises()

    expect(mockCreateFee).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
