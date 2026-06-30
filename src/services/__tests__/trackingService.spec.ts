import { describe, it, expect, vi, beforeEach } from 'vitest'
import trackingService from '@/services/trackingService'

const mockGet = vi.fn()
vi.mock('@/services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}))

describe('trackingService', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('getSentEmails forwards pagination/filter params and returns the data', async () => {
    const payload = { items: [], total: 0 }
    mockGet.mockResolvedValueOnce({ data: payload })

    const result = await trackingService.getSentEmails({ page: 1, page_size: 25 })

    expect(result).toEqual(payload)
    expect(mockGet).toHaveBeenCalledWith('/tracking/sent-emails', {
      params: { page: 1, page_size: 25 },
    })
  })

  it('getSentEmailDetail fetches a single email', async () => {
    mockGet.mockResolvedValueOnce({ data: { id: 5 } })
    const result = await trackingService.getSentEmailDetail(5)
    expect(result).toEqual({ id: 5 })
    expect(mockGet).toHaveBeenCalledWith('/tracking/sent-emails/5')
  })

  it('getEmailTemplates fetches template stats', async () => {
    mockGet.mockResolvedValueOnce({ data: [] })
    await trackingService.getEmailTemplates()
    expect(mockGet).toHaveBeenCalledWith('/tracking/sent-emails/templates')
  })

  it('getTemplatePreview URL-encodes the template key', async () => {
    mockGet.mockResolvedValueOnce({
      data: { template_key: 'a b', template_name: 'A B', html: '<p/>' },
    })
    await trackingService.getTemplatePreview('a b')
    expect(mockGet).toHaveBeenCalledWith('/tracking/sent-emails/templates/a%20b/preview')
  })

  it('getActivity forwards filter params', async () => {
    mockGet.mockResolvedValueOnce({ data: { items: [], total: 0 } })
    await trackingService.getActivity({ member_id: 3 })
    expect(mockGet).toHaveBeenCalledWith('/tracking/activity', { params: { member_id: 3 } })
  })

  it('getActivityDetail fetches a single activity entry', async () => {
    mockGet.mockResolvedValueOnce({ data: { id: 9 } })
    await trackingService.getActivityDetail(9)
    expect(mockGet).toHaveBeenCalledWith('/tracking/activity/9')
  })

  it('getActivitySessions forwards date/member filters', async () => {
    mockGet.mockResolvedValueOnce({ data: [] })
    await trackingService.getActivitySessions({ date_str: '2026-06-30' })
    expect(mockGet).toHaveBeenCalledWith('/tracking/activity/sessions', {
      params: { date_str: '2026-06-30' },
    })
  })

  it('getActivityStats fetches /tracking/activity/stats', async () => {
    mockGet.mockResolvedValueOnce({ data: {} })
    await trackingService.getActivityStats()
    expect(mockGet).toHaveBeenCalledWith('/tracking/activity/stats')
  })

  it('getConfig fetches the retention config', async () => {
    mockGet.mockResolvedValueOnce({ data: { retention_months: 24 } })
    const result = await trackingService.getConfig()
    expect(result).toEqual({ retention_months: 24 })
    expect(mockGet).toHaveBeenCalledWith('/tracking/config')
  })
})
