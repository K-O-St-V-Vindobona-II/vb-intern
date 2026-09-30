import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SumupBalanceView from '../SumupBalanceView.vue'
import PrimeVue from 'primevue/config'
import type { SumUpBalance } from '@/types/p4x'

const mockGetSumupBalance = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: { getSumupBalance: (...args: unknown[]) => mockGetSumupBalance(...args) },
}))

function buildBalance(overrides: Partial<SumUpBalance> = {}): SumUpBalance {
  return {
    in_count: 5,
    in_sum: 100,
    out_count: 2,
    out_sum: -30,
    latest: '2026-06-01',
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] } }

describe('SumupBalanceView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and shows the in/out counts, sums and computed saldo', async () => {
    mockGetSumupBalance.mockResolvedValue({ data: buildBalance() })
    const wrapper = mount(SumupBalanceView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Anzahl: 5')
    expect(wrapper.text()).toContain('Anzahl: 2')
    expect(wrapper.find('.saldo-amount').text()).toContain('70')
    wrapper.unmount()
  })

  it('shows a dash when there is no latest transaction date', async () => {
    mockGetSumupBalance.mockResolvedValue({ data: buildBalance({ latest: null }) })
    const wrapper = mount(SumupBalanceView, mountOpts)
    await flushPromises()

    const sections = wrapper.findAll('.section')
    expect(sections[0]!.text()).toContain('-')
    wrapper.unmount()
  })

  it('does not render the balance card while loading', () => {
    mockGetSumupBalance.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(SumupBalanceView, mountOpts)

    expect(wrapper.find('.sumup-card').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows a retry state instead of a silently empty page when loading fails, and recovers on retry', async () => {
    mockGetSumupBalance.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(SumupBalanceView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Die Daten konnten nicht geladen werden.')
    expect(wrapper.find('.sumup-card').exists()).toBe(false)
    const retryBtn = wrapper.findAll('button').find((b) => b.text() === 'Erneut versuchen')
    expect(retryBtn).toBeDefined()

    mockGetSumupBalance.mockResolvedValueOnce({ data: buildBalance() })
    await retryBtn!.trigger('click')
    await flushPromises()

    expect(mockGetSumupBalance).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('konnten nicht geladen werden')
    expect(wrapper.find('.sumup-card').exists()).toBe(true)
    wrapper.unmount()
  })
})
