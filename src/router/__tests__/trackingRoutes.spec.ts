import { describe, it, expect } from 'vitest'
import router from '@/router'

const MEMBER_ID = '0198f2a4-7b1c-7a3e-8d21-5f6a9c1e2b34'

describe('tracking routes', () => {
  it('resolves the member day view for a UUID', () => {
    const resolved = router.resolve(`/tracking/activity/members/${MEMBER_ID}?day=2026-06-15`)

    expect(resolved.name).toBe('tracking-activity-member')
    expect(resolved.params['memberId']).toBe(MEMBER_ID)
  })

  it('accepts an upper-case UUID', () => {
    const resolved = router.resolve(`/tracking/activity/members/${MEMBER_ID.toUpperCase()}`)

    expect(resolved.name).toBe('tracking-activity-member')
  })

  it.each([
    ['an encoded path traversal', '..%2F..%2Fauth%2Fsessions'],
    ['an encoded dot segment', '%2e%2e'],
    ['a plain word', 'members'],
    ['a UUID with a suffix', `${MEMBER_ID}%2Fextra`],
    ['a UUID with a trailing character', `${MEMBER_ID}x`],
    ['a truncated UUID', MEMBER_ID.slice(0, 35)],
  ])('does not resolve the member day view for %s', (_label, memberId) => {
    const resolved = router.resolve(`/tracking/activity/members/${memberId}?day=2026-06-15`)

    expect(resolved.name).toBe('not-found')
  })
})
