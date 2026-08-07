import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import FeeBalancesView from '../FeeBalancesView.vue'
import FeeMemberCriteriaInfoBox from '../components/FeeMemberCriteriaInfoBox.vue'
import PrimeVue from 'primevue/config'
import type { FeeBalanceEntry } from '@/types/p4x'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockGetFeeBalances = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: { getFeeBalances: (...args: unknown[]) => mockGetFeeBalances(...args) },
}))

function buildEntry(overrides: Partial<FeeBalanceEntry> = {}): FeeBalanceEntry {
  return { id: 1, cn: 'Max Mustermann', p4x_freed: false, balance: -15, ...overrides }
}

const mountOpts = { global: { plugins: [PrimeVue] } }

describe('FeeBalancesView', () => {
  it('loads and shows every fee member with their balance, not just debtors', async () => {
    mockGetFeeBalances.mockResolvedValue({
      data: [
        buildEntry({ id: 1, cn: 'Max Mustermann', balance: -15 }),
        buildEntry({ id: 2, cn: 'Erika Beispiel', balance: 200 }),
      ],
    })
    const wrapper = mount(FeeBalancesView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Max Mustermann')
    expect(wrapper.text()).toContain('Erika Beispiel')
    wrapper.unmount()
  })

  it('shows the count of fee-liable members with a set-up fee account', async () => {
    mockGetFeeBalances.mockResolvedValue({
      data: [buildEntry({ id: 1 }), buildEntry({ id: 2 }), buildEntry({ id: 3 })],
    })
    const wrapper = mount(FeeBalancesView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('3 beitragspflichtige Mitglieder')
    wrapper.unmount()
  })

  it('renders the shared FeeMemberCriteriaInfoBox', async () => {
    mockGetFeeBalances.mockResolvedValue({ data: [buildEntry()] })
    const wrapper = mount(FeeBalancesView, mountOpts)
    await flushPromises()

    expect(wrapper.findComponent(FeeMemberCriteriaInfoBox).exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows sortable Name and Saldo column headers', async () => {
    mockGetFeeBalances.mockResolvedValue({ data: [buildEntry()] })
    const wrapper = mount(FeeBalancesView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Name')
    expect(wrapper.text()).toContain('Saldo')
    wrapper.unmount()
  })

  it('navigates to the fee-member detail page when a name is clicked', async () => {
    mockGetFeeBalances.mockResolvedValue({ data: [buildEntry({ id: 9 })] })
    const wrapper = mount(FeeBalancesView, mountOpts)
    await flushPromises()

    await wrapper.find('.member-link').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-fee-member', params: { id: 9 } })
    wrapper.unmount()
  })

  it('shows a "Befreit" tag for freed members', async () => {
    mockGetFeeBalances.mockResolvedValue({ data: [buildEntry({ p4x_freed: true })] })
    const wrapper = mount(FeeBalancesView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Befreit')
    wrapper.unmount()
  })

  it('shows no "Befreit" tag for non-freed members', async () => {
    mockGetFeeBalances.mockResolvedValue({ data: [buildEntry({ p4x_freed: false })] })
    const wrapper = mount(FeeBalancesView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Befreit')
    wrapper.unmount()
  })

  it('shows the empty state when there are no fee balances', async () => {
    mockGetFeeBalances.mockResolvedValue({ data: [] })
    const wrapper = mount(FeeBalancesView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.empty').exists()).toBe(true)
    wrapper.unmount()
  })
})
