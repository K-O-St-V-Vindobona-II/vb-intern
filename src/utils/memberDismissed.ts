import type { MemberDetail, MemberDismissed } from '@/types/standesdb'

/**
 * Whether the member endpoint answered with the data-protection stub of a
 * dismissed member instead of the full entry.
 */
export const isDismissedStub = (data: MemberDetail | MemberDismissed): data is MemberDismissed =>
  'dataprotection' in data
