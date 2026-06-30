import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatApiError,
  getApiErrorStatus,
  getApiErrorDetail,
  formatSize,
} from '@/utils/formatters'

describe('formatDate', () => {
  it('returns an empty string for null', () => {
    expect(formatDate(null)).toBe('')
  })

  it('formats a date string in de-AT locale', () => {
    expect(formatDate('2026-06-30')).toBe(new Date('2026-06-30').toLocaleDateString('de-AT'))
  })
})

describe('formatDateTime', () => {
  it('returns an empty string for null', () => {
    expect(formatDateTime(null)).toBe('')
  })

  it('formats a date-time string in de-AT locale', () => {
    const dt = '2026-06-30T10:15:00Z'
    expect(formatDateTime(dt)).toBe(
      new Date(dt).toLocaleDateString('de-AT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    )
  })
})

describe('formatApiError', () => {
  it('returns the fallback when there is no detail', () => {
    expect(formatApiError({}, 'Fallback')).toBe('Fallback')
  })

  it('returns the default fallback when none is given', () => {
    expect(formatApiError({})).toBe('Fehler')
  })

  it('returns the detail string directly when it is a string', () => {
    const error = { response: { data: { detail: 'Konto gesperrt.' } } }
    expect(formatApiError(error)).toBe('Konto gesperrt.')
  })

  it('formats an array of validation errors with field and message', () => {
    const error = {
      response: {
        data: {
          detail: [
            { loc: ['body', 'email'], msg: 'Value error, invalid email' },
            { loc: ['body', 'password'], msg: 'field required' },
          ],
        },
      },
    }
    expect(formatApiError(error)).toBe('email: invalid email\npassword: field required')
  })

  it('falls back to the fallback for an unrecognized detail shape', () => {
    const error = { response: { data: { detail: 42 } } }
    expect(formatApiError(error, 'Unbekannt')).toBe('Unbekannt')
  })
})

describe('getApiErrorStatus', () => {
  it('extracts the response status', () => {
    expect(getApiErrorStatus({ response: { status: 404 } })).toBe(404)
  })

  it('returns undefined when there is no response', () => {
    expect(getApiErrorStatus(new Error('network'))).toBeUndefined()
  })

  it('returns undefined for non-object input', () => {
    expect(getApiErrorStatus('plain string')).toBeUndefined()
  })
})

describe('getApiErrorDetail', () => {
  it('extracts the response detail', () => {
    expect(getApiErrorDetail({ response: { data: { detail: 'oops' } } })).toBe('oops')
  })

  it('returns undefined when there is no response', () => {
    expect(getApiErrorDetail(new Error('network'))).toBeUndefined()
  })
})

describe('formatSize', () => {
  it('formats bytes below 1024 as B', () => {
    expect(formatSize(512)).toBe('512 B')
  })

  it('formats sizes below 1 MB as KB', () => {
    expect(formatSize(2048)).toBe('2 KB')
  })

  it('formats sizes at or above 1 MB as MB', () => {
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
