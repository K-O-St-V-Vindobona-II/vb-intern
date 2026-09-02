import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ActivityView from '../ActivityView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import type { ActivityLogItem, ActivitySession, ActivityLogDetail } from '@/types/tracking'

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

// PrimeVue's Tabs/TabList tracks the active ink-bar position via ResizeObserver.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

const mockGetSessions = vi.fn()
const mockGetStats = vi.fn()
const mockGetActivity = vi.fn()
const mockGetDetail = vi.fn()
const mockGetConfig = vi.fn()
vi.mock('@/services/trackingService', () => ({
  default: {
    getActivitySessions: (...args: unknown[]) => mockGetSessions(...args),
    getActivityStats: (...args: unknown[]) => mockGetStats(...args),
    getActivity: (...args: unknown[]) => mockGetActivity(...args),
    getActivityDetail: (...args: unknown[]) => mockGetDetail(...args),
    getConfig: (...args: unknown[]) => mockGetConfig(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

function buildAction(overrides: Partial<ActivityLogItem> = {}): ActivityLogItem {
  return {
    id: 1,
    created_at: '2026-06-01T10:00:00Z',
    member_id: 'member-uuid-1',
    member_name: 'Max Mustermann',
    action_label: 'Anmeldung',
    request_method: 'POST',
    request_path: '/api/auth/login',
    response_status: 200,
    client_ip: '127.0.0.1',
    ...overrides,
  }
}

function buildSession(overrides: Partial<ActivitySession> = {}): ActivitySession {
  return {
    member_id: 'member-uuid-1',
    member_name: 'Max Mustermann',
    started_at: '2026-06-01T10:00:00Z',
    ended_at: '2026-06-01T10:05:00Z',
    action_count: 1,
    actions: [buildAction()],
    ...overrides,
  }
}

function buildDetail(overrides: Partial<ActivityLogDetail> = {}): ActivityLogDetail {
  return {
    ...buildAction(),
    request_input: null,
    response_content: null,
    client_user_agent: null,
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue, ToastService] }, attachTo: document.body }

describe('ActivityView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSessions.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 })
    mockGetStats.mockResolvedValue({
      active_users_today: 2,
      total_actions_today: 15,
      actions_by_type: { Anmeldung: 5, 'Mitglied bearbeitet': 10 },
    })
    mockGetActivity.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25 })
    mockGetConfig.mockResolvedValue({ retention_months: 6 })
  })

  it('renders the activity view with tabs', async () => {
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('Aktivitätsprotokoll')
    expect(wrapper.text()).toContain('Timeline')
    expect(wrapper.text()).toContain('Statistiken')
    expect(wrapper.text()).toContain('Rohansicht')
    wrapper.unmount()
  })

  it('uses Dialog component instead of Drawer', async () => {
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()
    expect(wrapper.findComponent({ name: 'Dialog' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'Drawer' }).exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows empty state when no sessions', async () => {
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('Keine Aktivität an diesem Tag')
    wrapper.unmount()
  })

  it('uses the retention_months from the config endpoint', async () => {
    mockGetConfig.mockResolvedValue({ retention_months: 3 })
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('letzten 3 Monate')
    wrapper.unmount()
  })

  it('falls back to the default retention when the config request fails', async () => {
    mockGetConfig.mockRejectedValue(new Error('boom'))
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('letzten 6 Monate')
    wrapper.unmount()
  })

  it('shows an error toast when loading sessions fails', async () => {
    mockGetSessions.mockRejectedValue(new Error('boom'))
    mount(ActivityView, mountOpts)
    await flushPromises()
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('shows an error toast when loading stats fails', async () => {
    mockGetStats.mockRejectedValue(new Error('boom'))
    mount(ActivityView, mountOpts)
    await flushPromises()
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('shows an error toast when loading raw data fails', async () => {
    mockGetActivity.mockRejectedValue(new Error('boom'))
    mount(ActivityView, mountOpts)
    await flushPromises()
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('expands a session to show its actions', async () => {
    mockGetSessions.mockResolvedValue({
      items: [buildSession()],
      total: 1,
      page: 1,
      page_size: 100,
    })
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.action-item').exists()).toBe(false)
    await wrapper.find('.session-header').trigger('click')
    expect(wrapper.find('.action-item').exists()).toBe(true)
    expect(wrapper.text()).toContain('Anmeldung')

    await wrapper.find('.session-header').trigger('click')
    expect(wrapper.find('.action-item').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the detail dialog when an action is clicked', async () => {
    mockGetSessions.mockResolvedValue({
      items: [buildSession()],
      total: 1,
      page: 1,
      page_size: 100,
    })
    mockGetDetail.mockResolvedValue(
      buildDetail({ client_user_agent: 'Mozilla/5.0', request_input: '{"a":1}' }),
    )
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()
    await wrapper.find('.session-header').trigger('click')
    await wrapper.find('.action-item').trigger('click')
    await flushPromises()

    expect(mockGetDetail).toHaveBeenCalledWith(1)
    // Dialog content is teleported to document.body, outside the wrapper's DOM subtree.
    expect(document.body.textContent).toContain('Mozilla/5.0')
    expect(document.body.textContent).toContain('{"a":1}')
    wrapper.unmount()
  })

  it('shows an error toast when loading the detail fails', async () => {
    mockGetSessions.mockResolvedValue({
      items: [buildSession()],
      total: 1,
      page: 1,
      page_size: 100,
    })
    mockGetDetail.mockRejectedValue(new Error('boom'))
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()
    await wrapper.find('.session-header').trigger('click')
    await wrapper.find('.action-item').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    wrapper.unmount()
  })

  it('shows the top action-type bars sorted descending', async () => {
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('Top-Aktionen heute')
    const labels = wrapper.findAll('.action-bar-label').map((l) => l.text())
    expect(labels).toEqual(['Mitglied bearbeitet', 'Anmeldung'])
    wrapper.unmount()
  })

  it('hides the top action-type heading when stats failed to load', async () => {
    mockGetStats.mockRejectedValue(new Error('boom'))
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Top-Aktionen heute')
    wrapper.unmount()
  })

  it('shows raw activity rows with method and status tags', async () => {
    mockGetActivity.mockResolvedValue({
      items: [buildAction({ request_method: 'DELETE', response_status: 500 })],
      total: 1,
      page: 1,
      page_size: 25,
    })
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()

    const tags = wrapper.findAllComponents({ name: 'Tag' })
    const methodTag = tags.find((t) => t.props('value') === 'DELETE')
    const statusTag = tags.find((t) => t.props('value') === '500')
    expect(methodTag?.props('severity')).toBe('danger')
    expect(statusTag?.props('severity')).toBe('danger')
    wrapper.unmount()
  })

  it('requests the next page of raw activity data', async () => {
    mockGetActivity.mockResolvedValue({ items: [], total: 60, page: 1, page_size: 25 })
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()

    const table = wrapper.findComponent({ name: 'DataTable' })
    await table.vm.$emit('page', { page: 1 })
    await flushPromises()

    expect(mockGetActivity).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    wrapper.unmount()
  })

  it('shows the detail dialog when a raw row is clicked', async () => {
    const action = buildAction({ id: 7 })
    mockGetActivity.mockResolvedValue({ items: [action], total: 1, page: 1, page_size: 25 })
    mockGetDetail.mockResolvedValue(buildDetail({ id: 7 }))
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()

    const table = wrapper.findComponent({ name: 'DataTable' })
    await table.vm.$emit('row-click', { data: action })
    await flushPromises()

    expect(mockGetDetail).toHaveBeenCalledWith(7)
    wrapper.unmount()
  })

  it('reloads sessions when the timeline date changes', async () => {
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()
    expect(mockGetSessions).toHaveBeenCalledTimes(1)

    const datePicker = wrapper.findComponent({ name: 'DatePicker' })
    await datePicker.vm.$emit('update:modelValue', new Date(2026, 5, 15))
    await flushPromises()

    expect(mockGetSessions).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('resets to page 1 and reloads when a raw date filter changes', async () => {
    mockGetActivity.mockResolvedValue({ items: [], total: 60, page: 1, page_size: 25 })
    const wrapper = mount(ActivityView, mountOpts)
    await flushPromises()

    const table = wrapper.findComponent({ name: 'DataTable' })
    await table.vm.$emit('page', { page: 1 })
    await flushPromises()
    expect(mockGetActivity).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))

    const datePickers = wrapper.findAllComponents({ name: 'DatePicker' })
    await datePickers[1]!.vm.$emit('update:modelValue', new Date(2026, 5, 1))
    await flushPromises()

    expect(mockGetActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, date_from: '2026-06-01' }),
    )
    wrapper.unmount()
  })
})
