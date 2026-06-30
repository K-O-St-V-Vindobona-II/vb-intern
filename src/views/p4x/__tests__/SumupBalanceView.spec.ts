import { describe, it, expect, vi } from 'vitest'
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
})
