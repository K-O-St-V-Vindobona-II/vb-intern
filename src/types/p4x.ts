export interface PartnerRef {
  type: string
  id: number
  cn: string
}

export interface CategoryDirect {
  id: number
  p4x_category_id: number
  amount: number
}

export interface CategoryFilterShort {
  id: number
  name: string
  p4x_account_id: number
  p4x_account_label: string | null
  iban: string | null
  min_amount: number | null
  max_amount: number | null
  subject: string | null
  subject_mode: string
  p4x_category_id: number
  hitCount: number
}

export interface P4xTransaction {
  id: number
  booking: string | null
  valuation: string | null
  iban: string
  amount: number
  subject: string
  p4x_account_id: number
  p4x_account_cn: string
  p4x_account_iban: string
  comment: string | null
  has_attachment: boolean
  partner: PartnerRef | null
  delegating_partner: PartnerRef | null
  p4x_category_directs: CategoryDirect[]
  p4x_category_filters: CategoryFilterShort[]
}

export interface P4xAccount {
  id: number
  iban: string
  bic: string | null
  label: string | null
  init_date: string | null
  init_balance: number
  balance: number
  transactions_count: number
  transactions_latest: string | null
}

export interface P4xCategory {
  id: number
  name: string
  label: string
  background_color: string
  text_color: string
  protected: boolean
}

export interface CategoryWithUsage extends P4xCategory {
  used: { filter: number; direct: number }
}

export interface CategoryFilter {
  id: number
  name: string
  p4x_account_id: number
  p4x_account_label: string | null
  iban: string | null
  min_amount: number | null
  max_amount: number | null
  subject: string | null
  subject_mode: string
  p4x_category_id: number
  hitCount: number
}

export interface FilterHit {
  booking: string | null
  amount: number
  subject: string
  iban: string
}

export interface WarningsData {
  count: number
  preview: P4xTransaction[]
}

export interface DashboardData {
  accounts: P4xAccount[]
  warnings_partner: WarningsData
  warnings_category: WarningsData
  categories: P4xCategory[]
}

export interface PaginatedTransactions {
  items: P4xTransaction[]
  total: number
  page: number
  per_page: number
  startbalance?: number
  endbalance?: number
}

export interface ImportResult {
  given: { p4x_account_id: number; parsed: boolean }
  summary: Record<string, number>
  message?: string | null
  account?: P4xAccount
}

export interface P4xFee {
  start: string
  fee: number
  protected: boolean
}

export interface FeeProgressEntry {
  type: 'fee' | 'payment'
  booking: string
  amount: number
}

export interface FeeBalance {
  start_date: string
  start_balance: number
  count: { fees: number; payments: number }
  sum: { fees: number; payments: number }
  end_date: string
  end_balance: number
  progress: FeeProgressEntry[]
}

export interface FeeMember {
  id: number
  cn: string
  p4x_init_date: string | null
  p4x_init_balance: number | null
  p4x_freed: boolean | null
  p4x_comment: string | null
  balance: FeeBalance | null
}

export interface Debtor {
  id: number
  cn: string
  balance: number
}

export interface PartnerSearchResult {
  type: string
  id: number
  label: string
  [key: string]: unknown
}

export interface SumUpBalance {
  in_count: number
  in_sum: number
  out_count: number
  out_sum: number
  latest: string | null
}
