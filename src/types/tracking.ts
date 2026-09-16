export interface SentEmailListItem {
  id: string
  created_at: string | null
  to: string | null
  subject: string | null
  mailer: string | null
}

export interface SentEmailDetail extends SentEmailListItem {
  mail_from: string | null
  cc: string | null
  bcc: string | null
  body: string | null
  headers: string | null
}

export interface EmailTemplateStats {
  template_key: string
  template_name: string
  source_location: string
  count: number
  last_sent: string | null
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
