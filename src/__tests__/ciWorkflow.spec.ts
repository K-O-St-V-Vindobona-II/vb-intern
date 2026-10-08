import { describe, it, expect } from 'vitest'
import workflow from '../../.github/workflows/ci-cd.yml?raw'

const lines = workflow.split('\n')

// Returns the text of one top-level job: from its key up to the next job key.
function jobBlock(name: string): string {
  const start = lines.findIndex((line) => line === `  ${name}:`)
  if (start === -1) return ''
  const next = lines.findIndex((line, index) => index > start && /^ {2}\S/.test(line))
  return lines.slice(start, next === -1 ? undefined : next).join('\n')
}

describe('ci-cd.yml release job', () => {
  it('exists', () => {
    expect(jobBlock('release-image')).not.toBe('')
  })

  it('publishes the image only for a push or a manual run on main', () => {
    expect(jobBlock('release-image')).toContain(
      "if: (github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'",
    )
  })

  it('waits for the lint, quality, security and smoke test jobs', () => {
    expect(jobBlock('release-image')).toContain(
      'needs: [lint, quality, security, smoke-test-readonly]',
    )
  })
})

describe('ci-cd.yml smoke test', () => {
  const smoke = jobBlock('smoke-test-readonly')

  it('refuses a container whose runtime values are missing or malformed', () => {
    expect(smoke).toContain('- name: Refuse bad runtime values')
    expect(smoke).toContain('vb-intern:smoke-test nginx -t')
    expect(smoke).not.toContain('--cap-add')
  })

  it('starts with a run on valid values, so a refusal cannot come from the setup', () => {
    expect(smoke).toContain('start "" || { echo "The container did not start with valid values"')
  })

  it.each([
    '"API_BASE_URL="',
    '"API_BASE_URL=api.example.test"',
    `"API_BASE_URL=https://x.test/a'b"`,
    '"API_BASE_URL=https://x.test/a b"',
    "'API_BASE_URL=https://x.test/$(id)'",
    `"GOOGLE_CLIENT_ID=a'b"`,
    '"PASSWORD_MIN_LENGTH=twelve"',
    '"PASSWORD_MIN_LENGTH=0"',
    '"APP_ENVIRONMENT=staging"',
  ])('tries the bad value %s', (value) => {
    expect(smoke).toContain(value)
  })
})
