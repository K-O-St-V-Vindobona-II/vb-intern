import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ActivityLogView from '../ActivityLogView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import type { ActivityDayGroup } from '@/types/activityLog'

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
const mockReplace = vi.fn()
const mockRoute: { query: Record<string, string> } = { query: {} }
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
  useRouter: vi.fn(() => ({ push: mockPush, replace: mockReplace })),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockListDaysWithActivity = vi.fn()
vi.mock('@/services/activityLogService', () => ({
  default: {
    listDaysWithActivity: (...args: unknown[]) => mockListDaysWithActivity(...args),
  },
}))

const mockGetConfig = vi.fn()
vi.mock('@/services/trackingService', () => ({
  default: {
    getConfig: (...args: unknown[]) => mockGetConfig(...args),
  },
}))

function buildDayGroup(overrides: Partial<ActivityDayGroup> = {}): ActivityDayGroup {
  return {
    day: '2026-06-15',
    members: [{ id: 'member-uuid-1', label: 'Max Mustermann' }],
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue, ToastService] }, attachTo: document.body }

describe('ActivityLogView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.query = {}
    mockListDaysWithActivity.mockResolvedValue([buildDayGroup()])
    mockGetConfig.mockResolvedValue({ retention_months: 6 })
  })

  it('renders day groups with their members', async () => {
    const wrapper = mount(ActivityLogView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Max Mustermann')
  })

  it('shows an empty state when the month has no activity', async () => {
    mockListDaysWithActivity.mockResolvedValue([])
    const wrapper = mount(ActivityLogView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Keine Aktivität in diesem Monat.')
  })

  it('navigates to the member/day view when a member is clicked', async () => {
    const wrapper = mount(ActivityLogView, mountOpts)
    await flushPromises()

    await wrapper.find('.member-link').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({
      name: 'tracking-activity-member',
      params: { memberId: 'member-uuid-1' },
      query: { day: '2026-06-15' },
    })
  })

  it('shows a toast when loading the day groups fails', async () => {
    mockListDaysWithActivity.mockRejectedValue(new Error('boom'))
    mount(ActivityLogView, mountOpts)
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })
})
