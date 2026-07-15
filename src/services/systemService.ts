import api from '@/services/api'

export interface TableColumn {
  name: string
  type: string
  nullable: boolean
  primary_key: boolean
}

export interface TableDataResponse {
  table_name: string
  columns: TableColumn[]
  rows: Record<string, string | null>[]
  total: number
  page: number
  page_size: number
}

export interface PermissionRuleResponse {
  permission: string
  description: string
}

export interface ScheduledJobResponse {
  id: string
  name: string
  trigger: string
  next_run: string | null
  description: string | null
}

export interface BackupTriggerResponse {
  backup_name: string
  triggered_at: string
}

export default {
  getPermissionRules() {
    return api.get<PermissionRuleResponse[]>('/system/permission-rules')
  },

  getScheduledJobs() {
    return api.get<ScheduledJobResponse[]>('/system/scheduled-jobs')
  },

  triggerBackup() {
    return api.post<BackupTriggerResponse>('/system/backups/trigger')
  },

  getTables() {
    return api.get<string[]>('/system/tables')
  },

  getTableData(tableName: string, params: { page?: number; page_size?: number }) {
    return api.get<TableDataResponse>(`/system/tables/${tableName}`, { params })
  },
}
