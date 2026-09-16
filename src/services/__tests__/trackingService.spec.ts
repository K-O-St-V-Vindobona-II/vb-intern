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
    const id = '11111111-1111-1111-1111-111111111111'
    mockGet.mockResolvedValueOnce({ data: { id } })
    const result = await trackingService.getSentEmailDetail(id)
    expect(result).toEqual({ id })
    expect(mockGet).toHaveBeenCalledWith(`/tracking/sent-emails/${id}`)
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

  it('getConfig fetches the retention config', async () => {
    mockGet.mockResolvedValueOnce({ data: { retention_months: 24 } })
    const result = await trackingService.getConfig()
    expect(result).toEqual({ retention_months: 24 })
    expect(mockGet).toHaveBeenCalledWith('/tracking/config')
  })
})
