import { describe, it, expect, afterEach, vi } from 'vitest'
import { apiBaseUrl, googleClientId, passwordMinLength, appEnvironment } from '../runtimeConfig'

describe('runtimeConfig', () => {
  afterEach(() => {
    delete window.__APP_CONFIG__
    vi.unstubAllEnvs()
  })

  it('prefers window.__APP_CONFIG__ when present', () => {
    window.__APP_CONFIG__ = {
      API_BASE_URL: 'https://runtime.example/api',
      GOOGLE_CLIENT_ID: 'runtime-client-id',
      PASSWORD_MIN_LENGTH: '12',
      APP_ENVIRONMENT: 'qa',
    }

    expect(apiBaseUrl()).toBe('https://runtime.example/api')
    expect(googleClientId()).toBe('runtime-client-id')
    expect(passwordMinLength()).toBe(12)
    expect(appEnvironment()).toBe('qa')
  })

  it('falls back to import.meta.env.VITE_* when window.__APP_CONFIG__ is absent', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://dev.example/api')
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'dev-client-id')
    vi.stubEnv('VITE_PASSWORD_MIN_LENGTH', '10')
    vi.stubEnv('VITE_APP_ENVIRONMENT', 'development')

    expect(apiBaseUrl()).toBe('https://dev.example/api')
    expect(googleClientId()).toBe('dev-client-id')
    expect(passwordMinLength()).toBe(10)
    expect(appEnvironment()).toBe('development')
  })

  it('falls back to hardcoded literal defaults when neither source is set', () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.stubEnv('VITE_PASSWORD_MIN_LENGTH', '')

    expect(apiBaseUrl()).toBe('https://api.vindobona2.at/api')
    expect(passwordMinLength()).toBe(8)
  })
})
