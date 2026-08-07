import type { FeeProgressEntry } from '@/types/p4x'

export interface ProgressEntryDisplay {
  label: string
  cssClass: string
}

/**
 * Maps a fee-account progress entry to its display label and CSS class.
 * Shared between FeeMemberView.vue (admin) and MyFeeAccountView.vue
 * (self-service) so the mapping never drifts between the two - a plain
 * three-way switch is no longer trivial enough for an inline template
 * ternary once 'excess' is added (CLAUDE.md: complex logic belongs in
 * computed()/helpers, not the template).
 */
export function feeProgressEntryDisplay(entry: FeeProgressEntry): ProgressEntryDisplay {
  switch (entry.type) {
    case 'fee':
      return { label: 'Fälligkeit', cssClass: '' }
    case 'payment':
      return { label: 'Zahlung', cssClass: '' }
    case 'excess':
      return { label: 'Nicht angerechnet (Spende)', cssClass: 'progress-entry-excess' }
  }
}
