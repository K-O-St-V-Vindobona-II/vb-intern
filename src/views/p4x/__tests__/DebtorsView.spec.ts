import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import DebtorsView from '../DebtorsView.vue'
import PrimeVue from 'primevue/config'
import type { Debtor } from '@/types/p4x'

const mockGetDebtors = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: { getDebtors: (...args: unknown[]) => mockGetDebtors(...args) },
}))

function buildDebtor(overrides: Partial<Debtor> = {}): Debtor {
  return { id: 1, cn: 'Max Mustermann', balance: -15, ...overrides }
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/p4x/debtors', name: 'p4x-debtors', component: DebtorsView },
    { path: '/p4x/fee-members/:id', name: 'p4x-fee-member', component: { template: '<div />' } },
  ],
})

const mountOpts = { global: { plugins: [PrimeVue, router] } }

describe('DebtorsView', () => {
  it('loads and shows the debtors with their balance', async () => {
    mockGetDebtors.mockResolvedValue({ data: [buildDebtor()] })
    await router.push('/p4x/debtors')
    await router.isReady()
    const wrapper = mount(DebtorsView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Max Mustermann')
    expect(wrapper.find('.debtor-row').exists()).toBe(true)
    wrapper.unmount()
  })

  it('links each debtor row to their fee-member detail page', async () => {
    mockGetDebtors.mockResolvedValue({ data: [buildDebtor({ id: 9 })] })
    await router.push('/p4x/debtors')
    await router.isReady()
    const wrapper = mount(DebtorsView, mountOpts)
    await flushPromises()

    const link = wrapper.find('.debtor-name')
    expect(link.attributes('href')).toBe('/p4x/fee-members/9')
    wrapper.unmount()
  })

  it('shows the empty state when there are no debtors', async () => {
    mockGetDebtors.mockResolvedValue({ data: [] })
    await router.push('/p4x/debtors')
    await router.isReady()
    const wrapper = mount(DebtorsView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.empty').exists()).toBe(true)
    wrapper.unmount()
  })
})
