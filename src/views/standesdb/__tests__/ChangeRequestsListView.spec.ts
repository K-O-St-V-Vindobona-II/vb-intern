import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ChangeRequestsListView from '../ChangeRequestsListView.vue'
import PrimeVue from 'primevue/config'
import type { MemberChangeRequestSummary } from '@/types/standesdb'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockListChangeRequests = vi.fn()
vi.mock('@/services/standesdbService', () => ({
  default: {
    listChangeRequests: (...args: unknown[]) => mockListChangeRequests(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

function buildSummary(
  overrides: Partial<MemberChangeRequestSummary> = {},
): MemberChangeRequestSummary {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    member_id: '22222222-2222-2222-2222-222222222222',
    member_cn: 'Max Mustermann',
    member_org_id: 'vbw',
    field_count: 2,
    created_at: '2026-08-06T10:00:00Z',
    updated_at: '2026-08-06T10:00:00Z',
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] } }

async function mountList() {
  const wrapper = mount(ChangeRequestsListView, mountOpts)
  await flushPromises()
  return wrapper
}

describe('ChangeRequestsListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListChangeRequests.mockReset()
  })

  it('renders exactly what the service returns, without extra client-side filtering', async () => {
    mockListChangeRequests.mockResolvedValue({
      data: {
        items: [
          buildSummary({ id: '11111111-1111-1111-1111-111111111111' }),
          buildSummary({ id: '33333333-3333-3333-3333-333333333333', member_cn: 'Erika' }),
        ],
      },
    })

    const wrapper = mount(ChangeRequestsListView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Max Mustermann')
    expect(wrapper.text()).toContain('Erika')
  })

  it('shows an empty state when there are no pending requests', async () => {
    mockListChangeRequests.mockResolvedValue({ data: { items: [] } })

    const wrapper = mount(ChangeRequestsListView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Keine offenen Änderungsanträge.')
  })

  it('navigates to the review view when a row is clicked', async () => {
    const requestId = '44444444-4444-4444-4444-444444444444'
    mockListChangeRequests.mockResolvedValue({
      data: { items: [buildSummary({ id: requestId })] },
    })

    const wrapper = mount(ChangeRequestsListView, mountOpts)
    await flushPromises()

    await wrapper.find('.p-datatable-tbody tr').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({
      name: 'standesdb-change-request-review',
      params: { id: requestId },
    })
  })

  it('shows an error toast when loading fails', async () => {
    mockListChangeRequests.mockRejectedValue(new Error('boom'))

    mount(ChangeRequestsListView, mountOpts)
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('regression: opens the review from the keyboard, with Enter and with Space', async () => {
    const requestId = '44444444-4444-4444-4444-444444444444'
    mockListChangeRequests.mockResolvedValue({
      data: { items: [buildSummary({ id: requestId })] },
    })
    const wrapper = await mountList()
    const row = wrapper.find('.p-datatable-tbody tr')

    expect(row.attributes('tabindex')).toBe('0')
    await row.trigger('keydown', { code: 'Enter', key: 'Enter' })
    await row.trigger('keydown', { code: 'Space', key: ' ' })

    expect(mockPush).toHaveBeenCalledTimes(2)
    expect(mockPush).toHaveBeenLastCalledWith({
      name: 'standesdb-change-request-review',
      params: { id: requestId },
    })
  })

  it('shows the organisation in capitals, and a dash for a member without one', async () => {
    mockListChangeRequests.mockResolvedValue({
      data: {
        items: [
          buildSummary({ id: '55555555-5555-5555-5555-555555555555', member_org_id: 'vbn' }),
          buildSummary({ id: '66666666-6666-6666-6666-666666666666', member_org_id: null }),
        ],
      },
    })

    const wrapper = await mountList()

    const tags = wrapper.findAllComponents({ name: 'Tag' })
    expect(tags.map((t) => t.props('value'))).toEqual(['VBN', '-'])
  })

  it('shows a dash for a missing submission date', async () => {
    mockListChangeRequests.mockResolvedValue({
      data: { items: [buildSummary({ created_at: null })] },
    })

    const wrapper = await mountList()

    expect(wrapper.find('.p-datatable-tbody tr').text()).toContain('-')
    expect(wrapper.find('.p-datatable-tbody tr').text()).not.toContain('Invalid')
  })

  it('regression: does not claim there are no requests when the list could not be loaded', async () => {
    mockListChangeRequests.mockRejectedValue(new Error('boom'))

    const wrapper = await mountList()

    expect(wrapper.text()).toContain('Änderungsanträge konnten nicht geladen werden.')
    expect(wrapper.text()).not.toContain('Keine offenen Änderungsanträge.')
  })
})
