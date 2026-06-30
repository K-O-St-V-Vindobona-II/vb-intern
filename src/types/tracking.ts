export interface SentEmailListItem {
  id: number
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

export interface ActivityLogItem {
  id: number
  created_at: string | null
  member_id: number | null
  member_name: string | null
  action_label: string
  request_method: string
  request_path: string
  response_status: number
  client_ip: string
}

export interface ActivityLogDetail extends ActivityLogItem {
  request_input: string | null
  response_content: string | null
  client_user_agent: string | null
}

export interface ActivitySession {
  member_id: number
  member_name: string
  started_at: string
  ended_at: string
  action_count: number
  actions: ActivityLogItem[]
}

export interface ActivityStats {
  active_users_today: number
  total_actions_today: number
  actions_by_type: Record<string, number>
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
