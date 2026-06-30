import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ActivityView from '../ActivityView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

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

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

const mockGetSessions = vi.fn()
const mockGetStats = vi.fn()
const mockGetActivity = vi.fn()
const mockGetDetail = vi.fn()
vi.mock('@/services/trackingService', () => ({
  default: {
    getActivitySessions: (...args: unknown[]) => mockGetSessions(...args),
    getActivityStats: (...args: unknown[]) => mockGetStats(...args),
    getActivity: (...args: unknown[]) => mockGetActivity(...args),
    getActivityDetail: (...args: unknown[]) => mockGetDetail(...args),
  },
}))

describe('ActivityView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSessions.mockResolvedValue([])
    mockGetStats.mockResolvedValue({
      active_users_today: 2,
      total_actions_today: 15,
      actions_by_type: { Anmeldung: 5, 'Mitglied bearbeitet': 10 },
    })
    mockGetActivity.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 25,
    })
  })

  it('renders the activity view with tabs', async () => {
    const wrapper = mount(ActivityView, {
      global: { plugins: [PrimeVue, ToastService] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Aktivitätsprotokoll')
    expect(wrapper.text()).toContain('Timeline')
    expect(wrapper.text()).toContain('Statistiken')
    expect(wrapper.text()).toContain('Rohansicht')
  })

  it('uses Dialog component instead of Drawer', async () => {
    const wrapper = mount(ActivityView, {
      global: { plugins: [PrimeVue, ToastService] },
    })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'Dialog' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'Drawer' }).exists()).toBe(false)
  })

  it('shows empty state when no sessions', async () => {
    const wrapper = mount(ActivityView, {
      global: { plugins: [PrimeVue, ToastService] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Keine Aktivität an diesem Tag')
  })
})
