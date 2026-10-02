import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listRetentionMonths, useTrackingRetention } from '@/composables/useTrackingRetention'

const mockGetConfig = vi.fn()
vi.mock('@/services/trackingService', () => ({
  default: {
    getConfig: (...args: unknown[]) => mockGetConfig(...args),
  },
}))

describe('listRetentionMonths', () => {
  it('lists the months from the start of the window to the current month, oldest first', () => {
    const months = listRetentionMonths(2, new Date(2026, 5, 15))

    expect(months.map((m) => [m.year, m.month])).toEqual([
      [2026, 4],
      [2026, 5],
      [2026, 6],
    ])
  })

  it('crosses the year boundary', () => {
    const months = listRetentionMonths(3, new Date(2026, 1, 10))

    expect(months.map((m) => [m.year, m.month])).toEqual([
      [2025, 11],
      [2025, 12],
      [2026, 1],
      [2026, 2],
    ])
  })

  it('names the months in Austrian German', () => {
    const [january] = listRetentionMonths(0, new Date(2026, 0, 31))

    expect(january).toEqual({
      year: 2026,
      month: 1,
      monthName: 'Jänner',
      label: 'Jänner 2026',
    })
  })

  it('includes the current month on its first day at midnight', () => {
    const months = listRetentionMonths(0, new Date(2026, 5, 1, 0, 0, 0))

    expect(months.map((m) => [m.year, m.month])).toEqual([[2026, 6]])
  })

  it('contains only the current month for a retention of zero', () => {
    expect(listRetentionMonths(0, new Date(2026, 8, 30))).toHaveLength(1)
  })
})

describe('useTrackingRetention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with the default window of six months', () => {
    const { retentionMonths, months } = useTrackingRetention()

    expect(retentionMonths.value).toBe(6)
    expect(months.value).toHaveLength(7)
  })

  it('applies the configured retention and widens the month list', async () => {
    mockGetConfig.mockResolvedValue({ retention_months: 12 })
    const { retentionMonths, months, loadRetention } = useTrackingRetention()

    await loadRetention()

    expect(retentionMonths.value).toBe(12)
    expect(months.value).toHaveLength(13)
  })

  it('keeps the default when the configuration cannot be loaded', async () => {
    mockGetConfig.mockRejectedValue(new Error('boom'))
    const { retentionMonths, loadRetention } = useTrackingRetention()

    await loadRetention()

    expect(retentionMonths.value).toBe(6)
  })
})
