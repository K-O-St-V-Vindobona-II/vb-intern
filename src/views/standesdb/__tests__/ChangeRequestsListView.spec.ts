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
    id: 1,
    member_id: 10,
    member_cn: 'Max Mustermann',
    member_org_id: 'vbw',
    field_count: 2,
    created_at: '2026-08-06T10:00:00Z',
    updated_at: '2026-08-06T10:00:00Z',
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] } }

describe('ChangeRequestsListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders exactly what the service returns, without extra client-side filtering', async () => {
    mockListChangeRequests.mockResolvedValue({
      data: { items: [buildSummary({ id: 1 }), buildSummary({ id: 2, member_cn: 'Erika' })] },
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
    mockListChangeRequests.mockResolvedValue({ data: { items: [buildSummary({ id: 42 })] } })

    const wrapper = mount(ChangeRequestsListView, mountOpts)
    await flushPromises()

    await wrapper.find('.p-datatable-tbody tr').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({
      name: 'standesdb-change-request-review',
      params: { id: 42 },
    })
  })

  it('shows an error toast when loading fails', async () => {
    mockListChangeRequests.mockRejectedValue(new Error('boom'))

    mount(ChangeRequestsListView, mountOpts)
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })
})
