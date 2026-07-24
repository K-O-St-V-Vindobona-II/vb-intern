import api from '@/services/api'
import type {
  SentEmailListItem,
  SentEmailDetail,
  EmailTemplateStats,
  ActivityLogItem,
  ActivityLogDetail,
  ActivitySession,
  ActivityStats,
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

  async getSentEmailDetail(id: number): Promise<SentEmailDetail> {
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

  async getActivity(params: {
    page?: number
    page_size?: number
    member_id?: number
    date_from?: string
    date_to?: string
  }): Promise<PaginatedResponse<ActivityLogItem>> {
    const { data } = await api.get('/tracking/activity', { params })
    return data
  },

  async getActivityDetail(id: number): Promise<ActivityLogDetail> {
    const { data } = await api.get(`/tracking/activity/${id}`)
    return data
  },

  async getActivitySessions(params: {
    date_str?: string
    member_id?: number
    page?: number
    page_size?: number
  }): Promise<PaginatedResponse<ActivitySession>> {
    const { data } = await api.get('/tracking/activity/sessions', { params })
    return data
  },

  async getActivityStats(): Promise<ActivityStats> {
    const { data } = await api.get('/tracking/activity/stats')
    return data
  },

  async getConfig(): Promise<{ retention_months: number }> {
    const { data } = await api.get('/tracking/config')
    return data
  },
}
