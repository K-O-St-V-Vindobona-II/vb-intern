import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// Guards the release condition (only main may publish :latest to ghcr, which
// production pulls automatically) and the supply-chain settings of the
// workflow. Parses the real workflow file rather than duplicating its logic,
// so a later edit that removes one of them fails this test.

const workflowPath = resolve(process.cwd(), '.github/workflows/ci-cd.yml')
const workflow = parse(readFileSync(workflowPath, 'utf-8')) as {
  jobs: Record<
    string,
    { if?: string; 'timeout-minutes'?: number; steps?: Array<{ uses?: string; run?: string }> }
  >
  permissions?: Record<string, string>
  concurrency?: { group: string; 'cancel-in-progress': string }
}

describe('release-image job', () => {
  const releaseJob = workflow.jobs['release-image']

  it('only runs for a push or manual dispatch on main', () => {
    expect(releaseJob.if).toContain("github.ref == 'refs/heads/main'")
    expect(releaseJob.if).toContain("github.event_name == 'push'")
    expect(releaseJob.if).toContain("github.event_name == 'workflow_dispatch'")
  })

  it('never runs for a pull_request or schedule event', () => {
    // The condition combines the two allowed event names with && against the
    // ref check - a pull_request/schedule run therefore always evaluates false.
    expect(releaseJob.if).not.toContain('pull_request')
    expect(releaseJob.if).not.toContain('schedule')
  })
})

describe('workflow-level concurrency', () => {
  it('serialises runs of the same event on the same ref', () => {
    expect(workflow.concurrency?.group).toContain('github.event_name')
    expect(workflow.concurrency?.group).toContain('github.ref')
  })
})

describe('token permissions', () => {
  it('defaults the whole workflow to read-only', () => {
    expect(workflow.permissions?.['contents']).toBe('read')
  })
})

describe('job time limits', () => {
  it('gives every job a timeout', () => {
    for (const [name, job] of Object.entries(workflow.jobs)) {
      expect(job['timeout-minutes'], `job "${name}" needs timeout-minutes`).toBeGreaterThan(0)
    }
  })
})

describe('third-party actions', () => {
  const allSteps = Object.values(workflow.jobs).flatMap((job) => job.steps ?? [])
  const actionUses = allSteps
    .map((step) => step.uses)
    .filter((uses): uses is string => Boolean(uses))

  it('has at least one action to check', () => {
    expect(actionUses.length).toBeGreaterThan(0)
  })

  it('pins every action to a full commit SHA, not a movable tag', () => {
    for (const uses of actionUses) {
      const ref = uses.split('@')[1]
      expect(ref, `"${uses}" must be pinned to a 40-character commit SHA`).toMatch(/^[0-9a-f]{40}$/)
    }
  })
})

describe('read-only smoke test', () => {
  it('drops every capability instead of adding the old nginx:1-alpine set back', () => {
    const runScript = workflow.jobs['smoke-test-readonly'].steps
      ?.map((step) => step.run)
      .find((run) => run?.includes('docker run'))

    expect(runScript).toBeDefined()
    expect(runScript).toContain('--cap-drop=all')
    expect(runScript).not.toContain('--cap-add')
    expect(runScript).toContain('-p 8090:8080')
  })
})
