import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MyFeeAccountView from '../MyFeeAccountView.vue'
import PrimeVue from 'primevue/config'
import type { FeeMemberSelf } from '@/types/p4x'

const mockGetOwnFeeMember = vi.fn()
const mockExportOwnFeeMember = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getOwnFeeMember: (...args: unknown[]) => mockGetOwnFeeMember(...args),
    exportOwnFeeMember: (...args: unknown[]) => mockExportOwnFeeMember(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
const mockRevokeObjectURL = vi.fn()
vi.stubGlobal('URL', {
  ...URL,
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
})

function buildAccount(overrides: Partial<FeeMemberSelf> = {}): FeeMemberSelf {
  return {
    id: 1,
    cn: 'Max Mustermann',
    p4x_init_date: '2020-01-01',
    p4x_init_balance: 10,
    p4x_freed: false,
    balance: {
      start_date: '2020-01-01',
      start_balance: 10,
      count: { fees: 4, payments: 3 },
      sum: { fees: 40, payments: -30 },
      end_date: '2026-06-01',
      end_balance: 20,
      progress: [
        { type: 'fee', booking: '2026-01-01', amount: 10, balance: 20 },
        { type: 'payment', booking: '2026-02-01', amount: -10, balance: 10 },
      ],
    },
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

function findButtonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find((b) => b.text().includes(text))
  if (!button) throw new Error(`No button with text "${text}" found`)
  return button
}

describe('MyFeeAccountView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches the own fee account on mount, without any id parameter', async () => {
    mockGetOwnFeeMember.mockResolvedValue({ data: buildAccount() })
    const wrapper = mount(MyFeeAccountView, mountOpts)
    await flushPromises()

    expect(mockGetOwnFeeMember).toHaveBeenCalledWith()
    expect(wrapper.find('.account-detail').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows balance counts and sums when a balance is present', async () => {
    mockGetOwnFeeMember.mockResolvedValue({ data: buildAccount() })
    const wrapper = mount(MyFeeAccountView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('4 verrechnete Beiträge')
    expect(wrapper.text()).toContain('3 geleistete Zahlungen')
    expect(wrapper.find('.balance-total').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows an inline info message, not a crash, when the member is not fee-eligible (404)', async () => {
    mockGetOwnFeeMember.mockRejectedValue({ response: { status: 404 } })
    const wrapper = mount(MyFeeAccountView, mountOpts)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'Message' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('kein Beitragskonto hinterlegt')
    expect(wrapper.find('.account-detail').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows an error toast for non-404 failures, not the not-eligible message', async () => {
    mockGetOwnFeeMember.mockRejectedValue({ response: { status: 500 } })
    const wrapper = mount(MyFeeAccountView, mountOpts)
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    expect(wrapper.findComponent({ name: 'Message' }).exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows a hint instead of the overview when no init date is set', async () => {
    mockGetOwnFeeMember.mockResolvedValue({ data: buildAccount({ p4x_init_date: null }) })
    const wrapper = mount(MyFeeAccountView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.no-setup-hint').exists()).toBe(true)
    expect(wrapper.find('.balance-grid').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows only the freed fact, no summary/history/export, when freed', async () => {
    mockGetOwnFeeMember.mockResolvedValue({ data: buildAccount({ p4x_freed: true }) })
    const wrapper = mount(MyFeeAccountView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.account-freed').text()).toBe('Vom Mitgliedsbeitrag befreit')
    expect(wrapper.find('.balance-grid').exists()).toBe(false)
    expect(wrapper.find('.progress-section').exists()).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text().includes('Export Excel'))).toBe(false)
    wrapper.unmount()
  })

  it('never shows an edit button (self-service is read-only + export)', async () => {
    mockGetOwnFeeMember.mockResolvedValue({ data: buildAccount() })
    const wrapper = mount(MyFeeAccountView, mountOpts)
    await flushPromises()

    expect(wrapper.findAll('button').some((b) => b.text().includes('Bearbeiten'))).toBe(false)
    wrapper.unmount()
  })

  it('toggles the progress list visibility', async () => {
    mockGetOwnFeeMember.mockResolvedValue({ data: buildAccount() })
    const wrapper = mount(MyFeeAccountView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.progress-list').exists()).toBe(false)

    await wrapper.find('.progress-toggle').trigger('click')
    expect(wrapper.find('.progress-list').exists()).toBe(true)
    expect(wrapper.findAll('.progress-entry')).toHaveLength(2)
    wrapper.unmount()
  })

  it('exports the own account using the filename from the content-disposition header', async () => {
    mockGetOwnFeeMember.mockResolvedValue({ data: buildAccount() })
    mockExportOwnFeeMember.mockResolvedValue({
      data: new Blob(['x']),
      headers: { 'content-disposition': 'attachment; filename="Mein_Beitragskonto.xlsx"' },
    })
    const wrapper = mount(MyFeeAccountView, mountOpts)
    await flushPromises()

    await findButtonByText(wrapper, 'Export Excel').trigger('click')
    await flushPromises()

    expect(mockExportOwnFeeMember).toHaveBeenCalledWith()
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
    wrapper.unmount()
  })

  it('shows an error toast when the export fails', async () => {
    mockGetOwnFeeMember.mockResolvedValue({ data: buildAccount() })
    mockExportOwnFeeMember.mockRejectedValue(new Error('failed'))
    const wrapper = mount(MyFeeAccountView, mountOpts)
    await flushPromises()

    await findButtonByText(wrapper, 'Export Excel').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    wrapper.unmount()
  })
})
