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

const FUZZY_MONTHS = [
  '',
  'Jänner',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

function fuzzyMonthLabel(monthPart: string): string {
  return FUZZY_MONTHS[parseInt(monthPart)] ?? ''
}

// Displays a partial/uncertain date (year-only, year+month, or full date) at
// the given accuracy level. accuracy: 0 = unknown, 1 = year only,
// 2 = year+month, 3 = full date. The day is kept as the raw zero-padded
// string from the ISO date, matching formatDate/formatDateTime's 2-digit
// convention.
export function fuzzyDisplay(date: string | null | undefined, accuracy: number): string {
  if (!date || accuracy === 0) return 'unbekannt'

  const parts = date.split('-')
  const year = parts[0] ?? ''
  if (accuracy === 1) return year

  const monthLabel = fuzzyMonthLabel(parts[1] ?? '0')
  if (accuracy === 2) return `${monthLabel} ${year}`

  return `${parts[2] ?? ''}. ${monthLabel} ${year}`
}

// Displays a known-complete ISO date ("YYYY-MM-DD") spelled out in German,
// e.g. "05. März 2024". Unlike fuzzyDisplay, there is no accuracy level —
// callers only use this where a full date is guaranteed to be present.
export function formatFullDate(d: string | null | undefined): string {
  if (!d) return '–'

  const parts = d.split('-')
  const year = parts[0] ?? ''
  const monthLabel = fuzzyMonthLabel(parts[1] ?? '0')
  const day = parts[2] ?? ''

  return `${day}. ${monthLabel} ${year}`
}
