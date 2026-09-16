export interface IdLabelOption {
  id: string
  label: string
}

export interface ActivityDayGroup {
  day: string
  members: IdLabelOption[]
}

export interface ActivityLogEntry {
  id: string
  created_at: string
  request_method: string
  request_path: string
}

export interface ActivityMemberDayDetail {
  member_name: string
  entries: ActivityLogEntry[]
}

export interface ActivityLogDetail {
  id: string
  client_ip: string
  client_ips: string[]
  client_user_agent: string | null
  member_id: string | null
  member_name: string | null
  request_method: string
  request_path: string
  request_input: unknown
  response_status: number
  response_content: unknown
  memory_usage: number
  created_at: string
}
