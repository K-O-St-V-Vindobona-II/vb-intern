import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import FeeBalancesView from '../FeeBalancesView.vue'
import FeeMemberCriteriaInfoBox from '../components/FeeMemberCriteriaInfoBox.vue'
import PrimeVue from 'primevue/config'
import type { FeeBalanceEntry } from '@/types/p4x'

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockGetFeeBalances = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: { getFeeBalances: (...args: unknown[]) => mockGetFeeBalances(...args) },
}))

function buildEntry(overrides: Partial<FeeBalanceEntry> = {}): FeeBalanceEntry {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    cn: 'Max Mustermann',
    p4x_freed: false,
    balance: -15,
    ...overrides,
  }
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/p4x/fee-members/:id?', name: 'p4x-fee-member', component: { template: '<div />' } },
  ],
})

const mountOpts = { global: { plugins: [PrimeVue, router] } }

describe('FeeBalancesView', () => {
  it('loads and shows every fee member with their balance, not just debtors', async () => {
    mockGetFeeBalances.mockResolvedValue({
      data: [
        buildEntry({
          id: '11111111-1111-1111-1111-111111111111',
          cn: 'Max Mustermann',
          balance: -15,
        }),
        buildEntry({
          id: '22222222-2222-2222-2222-222222222222',
          cn: 'Erika Beispiel',
          balance: 200,
        }),
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
      data: [
        buildEntry({ id: '11111111-1111-1111-1111-111111111111' }),
        buildEntry({ id: '22222222-2222-2222-2222-222222222222' }),
        buildEntry({ id: '33333333-3333-3333-3333-333333333333' }),
      ],
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

  it('renders the member name as a real, keyboard-focusable link', async () => {
    mockGetFeeBalances.mockResolvedValue({
      data: [buildEntry({ id: '99999999-9999-9999-9999-999999999999' })],
    })
    const wrapper = mount(FeeBalancesView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.member-link').attributes('href')).toBe(
      '/p4x/fee-members/99999999-9999-9999-9999-999999999999',
    )
    wrapper.unmount()
  })

  it('navigates to the fee-member detail page when a name is clicked', async () => {
    mockGetFeeBalances.mockResolvedValue({
      data: [buildEntry({ id: '99999999-9999-9999-9999-999999999999' })],
    })
    const wrapper = mount(FeeBalancesView, mountOpts)
    await flushPromises()

    await wrapper.find('.member-link').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('p4x-fee-member')
    expect(router.currentRoute.value.params['id']).toBe('99999999-9999-9999-9999-999999999999')
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

  it('shows an error toast instead of a misleading empty state when loading fails', async () => {
    mockGetFeeBalances.mockRejectedValue(new Error('network error'))
    const wrapper = mount(FeeBalancesView, mountOpts)
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Saldenliste konnte nicht geladen werden.',
      }),
    )
    wrapper.unmount()
  })

  it('lists the largest debts first and colours each balance by its severity band', async () => {
    mockGetFeeBalances.mockResolvedValue({
      data: [
        buildEntry({ id: '11111111-1111-1111-1111-111111111111', cn: 'Plus', balance: 200 }),
        buildEntry({ id: '22222222-2222-2222-2222-222222222222', cn: 'Hoch', balance: -1500 }),
        buildEntry({ id: '33333333-3333-3333-3333-333333333333', cn: 'Leicht', balance: -50 }),
        buildEntry({ id: '44444444-4444-4444-4444-444444444444', cn: 'Mittel', balance: -500 }),
      ],
    })
    const wrapper = mount(FeeBalancesView, mountOpts)
    await flushPromises()

    const rows = wrapper.findAll('tbody tr').map((row) => ({
      name: row.find('.member-link').text(),
      amountClass: row.find('td:last-child span').classes()[0],
    }))
    expect(rows).toEqual([
      { name: 'Hoch', amountClass: 'amount-negative-high' },
      { name: 'Mittel', amountClass: 'amount-negative-mid' },
      { name: 'Leicht', amountClass: 'amount-negative-low' },
      { name: 'Plus', amountClass: 'amount-positive' },
    ])
    wrapper.unmount()
  })
})
