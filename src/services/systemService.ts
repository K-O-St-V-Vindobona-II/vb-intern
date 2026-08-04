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
  cns: string[]
}

export interface PermissionRulesResponse {
  rules: PermissionRuleResponse[]
  dev_superuser_cn: string | null
}

export interface EnvironmentResponse {
  environment: string
}

export interface ScheduledJobRunSummary {
  exit_code: number
  output: string | null
  started_at: string
  finished_at: string
  duration_seconds: number
}

export interface ScheduledJobRunListItem extends ScheduledJobRunSummary {
  id: number
  job_id: string
}

export interface ScheduledJobRunHistoryResponse {
  items: ScheduledJobRunListItem[]
  total: number
  page: number
  page_size: number
}

export interface ScheduledJobResponse {
  id: string
  name: string
  trigger: string
  next_run: string | null
  description: string | null
  last_run: ScheduledJobRunSummary | null
}

export interface BackupTriggerResponse {
  backup_name: string
  triggered_at: string
}

export default {
  getEnvironment() {
    return api.get<EnvironmentResponse>('/system/environment')
  },

  getPermissionRules() {
    return api.get<PermissionRulesResponse>('/system/permission-rules')
  },

  getScheduledJobs() {
    return api.get<ScheduledJobResponse[]>('/system/scheduled-jobs')
  },

  getJobRunHistory(jobId: string, params: { page?: number; page_size?: number }) {
    return api.get<ScheduledJobRunHistoryResponse>(`/system/scheduled-jobs/${jobId}/history`, {
      params,
    })
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
