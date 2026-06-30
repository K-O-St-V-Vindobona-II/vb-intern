import type { ApiValidationErrorItem } from '@/types/standesdb'

export function formatDate(dt: string | null): string {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('de-AT')
}

export function formatDateTime(dt: string | null): string {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatApiError(e: unknown, fallback = 'Fehler'): string {
  const resp = (e as { response?: { data?: { detail?: unknown } } })?.response
  if (!resp?.data?.detail) return fallback
  const detail = resp.data.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d: ApiValidationErrorItem) => {
        const field = d.loc?.filter((l) => l !== 'body').join('.') ?? ''
        const msg = (d.msg ?? '').replace(/^Value error, /, '')
        return field ? `${field}: ${msg}` : msg
      })
      .join('\n')
  }
  return fallback
}

export function getApiErrorStatus(e: unknown): number | undefined {
  return (e as { response?: { status?: number } })?.response?.status
}

export function getApiErrorDetail(e: unknown): unknown {
  return (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
