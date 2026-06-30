import { describe, it, expect, vi, beforeEach } from 'vitest'
import systemService from '@/services/systemService'

const mockGet = vi.fn()
vi.mock('@/services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}))

describe('systemService', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('getPermissionRules fetches /system/permission-rules', () => {
    systemService.getPermissionRules()
    expect(mockGet).toHaveBeenCalledWith('/system/permission-rules')
  })

  it('getScheduledJobs fetches /system/scheduled-jobs', () => {
    systemService.getScheduledJobs()
    expect(mockGet).toHaveBeenCalledWith('/system/scheduled-jobs')
  })

  it('getTables fetches /system/tables', () => {
    systemService.getTables()
    expect(mockGet).toHaveBeenCalledWith('/system/tables')
  })

  it('getTableData fetches a table with pagination params', () => {
    systemService.getTableData('members', { page: 2, page_size: 50 })
    expect(mockGet).toHaveBeenCalledWith('/system/tables/members', {
      params: { page: 2, page_size: 50 },
    })
  })
})
