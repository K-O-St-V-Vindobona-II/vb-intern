import { describe, it, expect, vi, beforeEach } from 'vitest'
import activityLogService from '@/services/activityLogService'

const mockGet = vi.fn()
vi.mock('@/services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}))

describe('activityLogService', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('listDaysWithActivity requests the month as query params', async () => {
    mockGet.mockResolvedValueOnce({ data: [] })
    await activityLogService.listDaysWithActivity(2026, 6)
    expect(mockGet).toHaveBeenCalledWith('/tracking/activity', {
      params: { year: 2026, month: 6 },
    })
  })

  it('getForMemberDay requests the member/day detail', async () => {
    mockGet.mockResolvedValueOnce({ data: { member_name: 'Test', entries: [] } })
    await activityLogService.getForMemberDay('member-uuid-1', '2026-06-15')
    expect(mockGet).toHaveBeenCalledWith('/tracking/activity/members/member-uuid-1', {
      params: { day: '2026-06-15' },
    })
  })

  it('getEntry fetches a single log entry', async () => {
    mockGet.mockResolvedValueOnce({ data: { id: 'log-uuid-1' } })
    const result = await activityLogService.getEntry('log-uuid-1')
    expect(result).toEqual({ id: 'log-uuid-1' })
    expect(mockGet).toHaveBeenCalledWith('/tracking/activity/log-uuid-1')
  })
})
