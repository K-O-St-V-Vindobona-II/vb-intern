import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import FeeMemberView from '../FeeMemberView.vue'
import PrimeVue from 'primevue/config'
import type { FeeMember } from '@/types/p4x'

const mockRoute: { params: Record<string, string> } = { params: {} }
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
}))

const mockSearchFeeMembers = vi.fn()
const mockGetFeeMember = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    searchFeeMembers: (...args: unknown[]) => mockSearchFeeMembers(...args),
    getFeeMember: (...args: unknown[]) => mockGetFeeMember(...args),
  },
}))

function buildMember(overrides: Partial<FeeMember> = {}): FeeMember {
  return {
    id: 1,
    cn: 'Max Mustermann',
    p4x_init_date: '2020-01-01',
    p4x_init_balance: 10,
    p4x_freed: false,
    p4x_comment: null,
    balance: {
      start_date: '2020-01-01',
      start_balance: 10,
      count: { fees: 4, payments: 3 },
      sum: { fees: 40, payments: -30 },
      end_date: '2026-06-01',
      end_balance: 20,
      progress: [
        { type: 'fee', booking: '2026-01-01', amount: 10 },
        { type: 'payment', booking: '2026-02-01', amount: -10 },
      ],
    },
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

describe('FeeMemberView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.params = {}
  })

  it('does not show member details before a member is loaded', async () => {
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(mockGetFeeMember).not.toHaveBeenCalled()
    expect(wrapper.find('.member-detail').exists()).toBe(false)
    wrapper.unmount()
  })

  it('loads the member from the route id on mount', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(mockGetFeeMember).toHaveBeenCalledWith(1)
    expect(wrapper.find('.member-name').text()).toBe('Max Mustermann')
    wrapper.unmount()
  })

  it('shows balance counts and sums when a balance is present', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('4 verrechnete Beiträge')
    expect(wrapper.text()).toContain('3 geleistete Zahlungen')
    expect(wrapper.find('.balance-total').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not show fee/payment rows when the member has no balance yet', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember({ balance: null }) })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.balance-total').exists()).toBe(false)
    expect(wrapper.find('.progress-section').exists()).toBe(false)
    wrapper.unmount()
  })

  it('loads a member when selected via the search field', async () => {
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()
    mockGetFeeMember.mockResolvedValue({ data: buildMember({ id: 5, cn: 'Erika Beispiel' }) })

    const search = wrapper.findComponent({ name: 'PersonSearchField' })
    await search.vm.$emit('select', { id: 5, label: 'Erika Beispiel', type: 'member' })
    await flushPromises()

    expect(mockGetFeeMember).toHaveBeenCalledWith(5)
    expect(wrapper.find('.member-name').text()).toBe('Erika Beispiel')
    wrapper.unmount()
  })

  it('forwards the query to searchFeeMembers via the search-fn prop', async () => {
    mockSearchFeeMembers.mockResolvedValue({
      data: { data: [{ id: 1, label: 'Max', type: 'member' }] },
    })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    const search = wrapper.findComponent({ name: 'PersonSearchField' })
    const found = await (search.props('searchFn') as (q: string) => Promise<unknown>)('Max')

    expect(mockSearchFeeMembers).toHaveBeenCalledWith('Max')
    expect(found).toEqual([{ id: 1, label: 'Max', type: 'member' }])
    wrapper.unmount()
  })

  it('toggles the progress list visibility', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.progress-list').exists()).toBe(false)

    await wrapper.find('.progress-toggle').trigger('click')
    expect(wrapper.find('.progress-list').exists()).toBe(true)
    expect(wrapper.findAll('.progress-entry')).toHaveLength(2)

    await wrapper.find('.progress-toggle').trigger('click')
    expect(wrapper.find('.progress-list').exists()).toBe(false)
    wrapper.unmount()
  })
})
