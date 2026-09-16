import api from '@/services/api'
import type {
  SentEmailListItem,
  SentEmailDetail,
  EmailTemplateStats,
  PaginatedResponse,
} from '@/types/tracking'

export default {
  async getSentEmails(params: {
    page?: number
    page_size?: number
    year?: number
    month?: number
    search?: string
  }): Promise<PaginatedResponse<SentEmailListItem>> {
    const { data } = await api.get('/tracking/sent-emails', { params })
    return data
  },

  async getSentEmailDetail(id: string): Promise<SentEmailDetail> {
    const { data } = await api.get(`/tracking/sent-emails/${id}`)
    return data
  },

  async getEmailTemplates(): Promise<EmailTemplateStats[]> {
    const { data } = await api.get('/tracking/sent-emails/templates')
    return data
  },

  async getTemplatePreview(
    templateKey: string,
  ): Promise<{ template_key: string; template_name: string; html: string }> {
    const { data } = await api.get(
      `/tracking/sent-emails/templates/${encodeURIComponent(templateKey)}/preview`,
    )
    return data
  },

  async getConfig(): Promise<{ retention_months: number }> {
    const { data } = await api.get('/tracking/config')
    return data
  },
}
