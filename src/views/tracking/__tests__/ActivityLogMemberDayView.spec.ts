import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ActivityLogMemberDayView from '../ActivityLogMemberDayView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import type { ActivityLogDetail, ActivityMemberDayDetail } from '@/types/activityLog'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const mockPush = vi.fn()
const mockRoute: { query: Record<string, string> } = { query: { day: '2026-06-15' } }
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockGetForMemberDay = vi.fn()
const mockGetEntry = vi.fn()
vi.mock('@/services/activityLogService', () => ({
  default: {
    getForMemberDay: (...args: unknown[]) => mockGetForMemberDay(...args),
    getEntry: (...args: unknown[]) => mockGetEntry(...args),
  },
}))

function buildDetail(overrides: Partial<ActivityMemberDayDetail> = {}): ActivityMemberDayDetail {
  return {
    member_name: 'Max Mustermann',
    entries: [
      {
        id: 'log-uuid-1',
        created_at: '2026-06-15T10:00:00+00:00',
        request_method: 'GET',
        request_path: '/api/standesdb/members',
      },
    ],
    ...overrides,
  }
}

function buildEntryDetail(overrides: Partial<ActivityLogDetail> = {}): ActivityLogDetail {
  return {
    id: 'log-uuid-1',
    client_ip: '127.0.0.1',
    client_ips: ['127.0.0.1'],
    client_user_agent: 'Mozilla/5.0',
    member_id: 'member-uuid-1',
    member_name: 'Max Mustermann',
    request_method: 'GET',
    request_path: '/api/standesdb/members',
    request_input: null,
    response_status: 200,
    response_content: null,
    memory_usage: 1024,
    created_at: '2026-06-15T10:00:00+00:00',
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue, ToastService] }, attachTo: document.body }

describe('ActivityLogMemberDayView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.query = { day: '2026-06-15' }
    mockGetForMemberDay.mockResolvedValue(buildDetail())
    mockGetEntry.mockResolvedValue(buildEntryDetail())
  })

  it('loads and renders the member/day entries', async () => {
    const wrapper = mount(ActivityLogMemberDayView, {
      ...mountOpts,
      props: { memberId: 'member-uuid-1' },
    })
    await flushPromises()

    expect(mockGetForMemberDay).toHaveBeenCalledWith('member-uuid-1', '2026-06-15')
    expect(wrapper.text()).toContain('Max Mustermann')
    expect(wrapper.text()).toContain('/api/standesdb/members')
  })

  it('shows an empty state when there are no entries', async () => {
    mockGetForMemberDay.mockResolvedValue(buildDetail({ entries: [] }))
    const wrapper = mount(ActivityLogMemberDayView, {
      ...mountOpts,
      props: { memberId: 'member-uuid-1' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Keine Aktivität an diesem Tag.')
  })

  it('navigates back to the index with the derived year/month', async () => {
    const wrapper = mount(ActivityLogMemberDayView, {
      ...mountOpts,
      props: { memberId: 'member-uuid-1' },
    })
    await flushPromises()

    await wrapper.find('button[aria-label="Zurück zur Übersicht"]').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({
      name: 'tracking-activity',
      query: { year: '2026', month: '06' },
    })
  })

  it('opens the detail dialog for an entry', async () => {
    const wrapper = mount(ActivityLogMemberDayView, {
      ...mountOpts,
      props: { memberId: 'member-uuid-1' },
    })
    await flushPromises()

    await wrapper.find('button[aria-label="Details anzeigen"]').trigger('click')
    await flushPromises()

    expect(mockGetEntry).toHaveBeenCalledWith('log-uuid-1')
    expect(document.body.textContent).toContain('Mozilla/5.0')
  })

  it('shows a toast when loading entries fails', async () => {
    mockGetForMemberDay.mockRejectedValue(new Error('boom'))
    mount(ActivityLogMemberDayView, { ...mountOpts, props: { memberId: 'member-uuid-1' } })
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })
})
