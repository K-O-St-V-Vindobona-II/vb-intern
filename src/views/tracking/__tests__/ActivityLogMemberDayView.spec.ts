import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
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
const mockRoute = reactive<{ query: Record<string, string | string[]> }>({
  query: { day: '2026-06-15' },
})
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

  it('shows a toast when loading the entry detail fails', async () => {
    mockGetEntry.mockRejectedValue(new Error('boom'))
    const wrapper = mount(ActivityLogMemberDayView, {
      ...mountOpts,
      props: { memberId: 'member-uuid-1' },
    })
    await flushPromises()

    await wrapper.find('button[aria-label="Details anzeigen"]').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    expect(document.body.textContent).not.toContain('Aktivitäts-Detail')
  })

  it.each([
    ['is missing', {}],
    ['is not a calendar day', { day: '../../auth/sessions' }],
    ['has a trailing part', { day: '2026-06-15/../x' }],
    ['has a leading part', { day: 'x2026-06-15' }],
    ['is given twice', { day: ['2026-06-15', '2026-06-16'] }],
  ])('does not call the API when the day %s', async (_label, query) => {
    mockRoute.query = query
    const wrapper = mount(ActivityLogMemberDayView, {
      ...mountOpts,
      props: { memberId: 'member-uuid-1' },
    })
    await flushPromises()

    expect(mockGetForMemberDay).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Keine Aktivität an diesem Tag.')
  })

  describe('switching between members', () => {
    function deferredDetail() {
      let resolvePromise!: (value: ActivityMemberDayDetail) => void
      let rejectPromise!: (reason: unknown) => void
      const promise = new Promise<ActivityMemberDayDetail>((resolve, reject) => {
        resolvePromise = resolve
        rejectPromise = reject
      })
      return { promise, resolve: resolvePromise, reject: rejectPromise }
    }

    it('regression: the entries of the previous member are gone while the next one loads', async () => {
      const wrapper = mount(ActivityLogMemberDayView, {
        ...mountOpts,
        props: { memberId: 'member-uuid-1' },
      })
      await flushPromises()
      expect(wrapper.text()).toContain('Max Mustermann')
      const next = deferredDetail()
      mockGetForMemberDay.mockReturnValueOnce(next.promise)

      await wrapper.setProps({ memberId: 'member-uuid-2' })
      await flushPromises()

      expect(wrapper.text()).not.toContain('Max Mustermann')
      expect(wrapper.text()).not.toContain('/api/standesdb/members')
    })

    it('regression: a slow answer for the earlier member does not replace the newer entries', async () => {
      const slow = deferredDetail()
      mockGetForMemberDay.mockReturnValueOnce(slow.promise)
      const wrapper = mount(ActivityLogMemberDayView, {
        ...mountOpts,
        props: { memberId: 'member-uuid-1' },
      })
      mockGetForMemberDay.mockResolvedValueOnce(buildDetail({ member_name: 'Erika Musterfrau' }))

      await wrapper.setProps({ memberId: 'member-uuid-2' })
      await flushPromises()
      slow.resolve(buildDetail({ member_name: 'Stale Member' }))
      await flushPromises()

      expect(wrapper.text()).toContain('Erika Musterfrau')
      expect(wrapper.text()).not.toContain('Stale Member')
    })

    it('regression: a slow answer for the earlier member does not end the loading state of the newer one', async () => {
      const slow = deferredDetail()
      const current = deferredDetail()
      mockGetForMemberDay.mockReturnValueOnce(slow.promise).mockReturnValueOnce(current.promise)
      const wrapper = mount(ActivityLogMemberDayView, {
        ...mountOpts,
        props: { memberId: 'member-uuid-1' },
      })

      await wrapper.setProps({ memberId: 'member-uuid-2' })
      slow.resolve(buildDetail({ member_name: 'Stale Member' }))
      await flushPromises()
      const table = wrapper.findComponent({ name: 'DataTable' })

      expect(table.props('loading')).toBe(true)

      current.resolve(buildDetail({ member_name: 'Erika Musterfrau' }))
      await flushPromises()

      expect(table.props('loading')).toBe(false)
    })

    it('regression: an answer that arrives after the day became invalid is discarded and ends loading', async () => {
      const slow = deferredDetail()
      mockGetForMemberDay.mockReturnValueOnce(slow.promise)
      const wrapper = mount(ActivityLogMemberDayView, {
        ...mountOpts,
        props: { memberId: 'member-uuid-1' },
      })

      mockRoute.query = {}
      await flushPromises()
      slow.resolve(buildDetail({ member_name: 'Stale Member' }))
      await flushPromises()

      expect(wrapper.text()).not.toContain('Stale Member')
      expect(wrapper.findComponent({ name: 'DataTable' }).props('loading')).toBe(false)
    })

    it('regression: a late failure of the earlier member raises no toast', async () => {
      const slow = deferredDetail()
      mockGetForMemberDay.mockReturnValueOnce(slow.promise)
      const wrapper = mount(ActivityLogMemberDayView, {
        ...mountOpts,
        props: { memberId: 'member-uuid-1' },
      })
      mockGetForMemberDay.mockResolvedValueOnce(buildDetail({ member_name: 'Erika Musterfrau' }))

      await wrapper.setProps({ memberId: 'member-uuid-2' })
      await flushPromises()
      slow.reject(new Error('boom'))
      await flushPromises()

      expect(mockToastAdd).not.toHaveBeenCalled()
    })
  })

  it('regression: a late failure of the detail of an earlier row raises no toast', async () => {
    mockGetForMemberDay.mockResolvedValue(
      buildDetail({
        entries: [
          {
            id: 'log-uuid-1',
            created_at: '2026-06-15T10:00:00+00:00',
            request_method: 'GET',
            request_path: '/api/first',
          },
          {
            id: 'log-uuid-2',
            created_at: '2026-06-15T11:00:00+00:00',
            request_method: 'POST',
            request_path: '/api/second',
          },
        ],
      }),
    )
    let rejectSlow!: (reason: unknown) => void
    mockGetEntry
      .mockReturnValueOnce(
        new Promise<ActivityLogDetail>((_resolve, reject) => {
          rejectSlow = reject
        }),
      )
      .mockResolvedValueOnce(buildEntryDetail({ id: 'log-uuid-2', client_user_agent: 'Newer UA' }))
    const wrapper = mount(ActivityLogMemberDayView, {
      ...mountOpts,
      props: { memberId: 'member-uuid-1' },
    })
    await flushPromises()
    const buttons = wrapper.findAll('button[aria-label="Details anzeigen"]')

    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')
    await flushPromises()
    rejectSlow(new Error('boom'))
    await flushPromises()

    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('regression: a slow detail answer for an earlier row does not replace the newer one', async () => {
    mockGetForMemberDay.mockResolvedValue(
      buildDetail({
        entries: [
          {
            id: 'log-uuid-1',
            created_at: '2026-06-15T10:00:00+00:00',
            request_method: 'GET',
            request_path: '/api/first',
          },
          {
            id: 'log-uuid-2',
            created_at: '2026-06-15T11:00:00+00:00',
            request_method: 'POST',
            request_path: '/api/second',
          },
        ],
      }),
    )
    let resolveSlow!: (value: ActivityLogDetail) => void
    mockGetEntry
      .mockReturnValueOnce(
        new Promise<ActivityLogDetail>((resolve) => {
          resolveSlow = resolve
        }),
      )
      .mockResolvedValueOnce(buildEntryDetail({ id: 'log-uuid-2', client_user_agent: 'Newer UA' }))
    const wrapper = mount(ActivityLogMemberDayView, {
      ...mountOpts,
      props: { memberId: 'member-uuid-1' },
    })
    await flushPromises()
    const buttons = wrapper.findAll('button[aria-label="Details anzeigen"]')

    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')
    await flushPromises()
    resolveSlow(buildEntryDetail({ id: 'log-uuid-1', client_user_agent: 'Stale UA' }))
    await flushPromises()

    expect(document.body.textContent).toContain('Newer UA')
    expect(document.body.textContent).not.toContain('Stale UA')
  })
})
