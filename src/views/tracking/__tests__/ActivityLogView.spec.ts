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

function monthsAgo(count: number): { year: number; month: number } {
  const date = new Date(new Date().getFullYear(), new Date().getMonth() - count, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
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

  it('offers the months newest first, starting with the current month', async () => {
    const now = new Date()
    const wrapper = mount(ActivityLogView, mountOpts)
    await flushPromises()

    const options = wrapper.findComponent({ name: 'Select' }).props('options') as {
      year: number
      month: number
    }[]
    expect(options[0]).toMatchObject({ year: now.getFullYear(), month: now.getMonth() + 1 })
    expect(options).toHaveLength(7)
  })

  it('restores a month beyond the default window once the configured retention is known', async () => {
    mockGetConfig.mockResolvedValue({ retention_months: 12 })
    const older = monthsAgo(9)
    mockRoute.query = { year: String(older.year), month: String(older.month) }
    mount(ActivityLogView, mountOpts)
    await flushPromises()

    expect(mockListDaysWithActivity).toHaveBeenCalledTimes(1)
    expect(mockListDaysWithActivity).toHaveBeenCalledWith(older.year, older.month)
  })

  it('resolves the year of the address too, not only the month number', async () => {
    mockGetConfig.mockResolvedValue({ retention_months: 12 })
    const lastYearSameMonth = monthsAgo(12)
    mockRoute.query = {
      year: String(lastYearSameMonth.year),
      month: String(lastYearSameMonth.month),
    }
    mount(ActivityLogView, mountOpts)
    await flushPromises()

    expect(mockListDaysWithActivity).toHaveBeenCalledWith(
      lastYearSameMonth.year,
      lastYearSameMonth.month,
    )
  })

  it('shows the requested month in the selector, not the current one', async () => {
    mockGetConfig.mockResolvedValue({ retention_months: 12 })
    const older = monthsAgo(9)
    mockRoute.query = { year: String(older.year), month: String(older.month) }
    const wrapper = mount(ActivityLogView, mountOpts)
    await flushPromises()

    const selected = wrapper.findComponent({ name: 'Select' }).props('modelValue')
    expect(selected).toMatchObject({ year: older.year, month: older.month })
  })

  it('falls back to the current month and rewrites the address for a month outside the window', async () => {
    const now = new Date()
    mockRoute.query = { year: '2001', month: '1' }
    mount(ActivityLogView, mountOpts)
    await flushPromises()

    expect(mockListDaysWithActivity).toHaveBeenCalledWith(now.getFullYear(), now.getMonth() + 1)
    expect(mockReplace).toHaveBeenCalledWith({
      query: { year: now.getFullYear(), month: now.getMonth() + 1 },
    })
  })

  it('keeps the current month when the configuration cannot be loaded', async () => {
    const now = new Date()
    mockGetConfig.mockRejectedValue(new Error('boom'))
    mount(ActivityLogView, mountOpts)
    await flushPromises()

    expect(mockListDaysWithActivity).toHaveBeenCalledWith(now.getFullYear(), now.getMonth() + 1)
  })

  describe('switching the month', () => {
    function deferredDays() {
      let resolvePromise!: (value: ActivityDayGroup[]) => void
      let rejectPromise!: (reason: unknown) => void
      const promise = new Promise<ActivityDayGroup[]>((resolve, reject) => {
        resolvePromise = resolve
        rejectPromise = reject
      })
      return { promise, resolve: resolvePromise, reject: rejectPromise }
    }

    async function mountAndSelect(
      index: number,
      slowAnswer: Promise<ActivityDayGroup[]>,
      firstAnswer: ActivityDayGroup[] = [buildDayGroup()],
    ) {
      mockListDaysWithActivity.mockResolvedValueOnce(firstAnswer).mockReturnValueOnce(slowAnswer)
      const wrapper = mount(ActivityLogView, mountOpts)
      await flushPromises()
      const select = wrapper.findComponent({ name: 'Select' })
      const options = select.props('options') as unknown[]
      await select.vm.$emit('update:modelValue', options[index])
      return { wrapper, select, options }
    }

    it('regression: a slow answer for the earlier month does not replace the newer days', async () => {
      const slow = deferredDays()
      const { wrapper, select, options } = await mountAndSelect(1, slow.promise)
      mockListDaysWithActivity.mockResolvedValueOnce([
        buildDayGroup({ day: '2026-03-02', members: [{ id: 'm-2', label: 'Newer Member' }] }),
      ])

      await select.vm.$emit('update:modelValue', options[2])
      await flushPromises()
      slow.resolve([
        buildDayGroup({ day: '2026-04-09', members: [{ id: 'm-1', label: 'Stale Member' }] }),
      ])
      await flushPromises()

      expect(wrapper.text()).toContain('Newer Member')
      expect(wrapper.text()).not.toContain('Stale Member')
    })

    it('regression: a late failure of the earlier month raises no toast and keeps the loading state', async () => {
      const slow = deferredDays()
      const { wrapper, select, options } = await mountAndSelect(1, slow.promise, [])
      const newer = deferredDays()
      mockListDaysWithActivity.mockReturnValueOnce(newer.promise)

      await select.vm.$emit('update:modelValue', options[2])
      slow.reject(new Error('boom'))
      await flushPromises()

      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(wrapper.text()).not.toContain('Keine Aktivität in diesem Monat.')
      newer.resolve([])
      await flushPromises()
      expect(wrapper.text()).toContain('Keine Aktivität in diesem Monat.')
    })

    it('writes the selected month into the address', async () => {
      const { options } = await mountAndSelect(1, Promise.resolve([]))
      await flushPromises()

      const chosen = options[1] as { year: number; month: number }
      expect(mockReplace).toHaveBeenLastCalledWith({
        query: { year: chosen.year, month: chosen.month },
      })
    })
  })
})
