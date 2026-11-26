import { describe, it, expect } from 'vitest'
import { isDismissedStub } from '../memberDismissed'
import type { MemberDetail, MemberDismissed } from '@/types/standesdb'

describe('isDismissedStub', () => {
  it('recognises the data-protection stub', () => {
    const stub: MemberDismissed = { id: '1', cn: 'A', org_id: 'vbw', dataprotection: 'dismissed' }
    expect(isDismissedStub(stub)).toBe(true)
  })

  it('does not take a full entry for the stub', () => {
    const detail = { id: '1', cn: 'A', org_id: 'vbw', entlassen: true } as MemberDetail
    expect(isDismissedStub(detail)).toBe(false)
  })
})
