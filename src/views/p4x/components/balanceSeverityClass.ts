/**
 * Maps a fee-account balance to its display severity class for the
 * Saldenliste (FeeBalancesView.vue). Shared, pure mapping so the
 * threshold logic lives in exactly one place (project convention: complex
 * logic belongs in computed()/helpers, not the template) and stays reusable
 * as the CSS class names already defined on Amount.vue.
 *
 * Bands (inclusive lower bound, per spec):
 * - balance >= 0:          green   ('amount-positive')
 * - -300    <= balance < 0:    yellow  ('amount-negative-low')
 * - -1000   <= balance < -300: red     ('amount-negative-mid')
 * - balance < -1000:           red, bold ('amount-negative-high')
 */
export function balanceSeverityClass(balance: number): string {
  if (balance >= 0) return 'amount-positive'
  if (balance >= -300) return 'amount-negative-low'
  if (balance >= -1000) return 'amount-negative-mid'
  return 'amount-negative-high'
}
