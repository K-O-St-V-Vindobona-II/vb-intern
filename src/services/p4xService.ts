import api from './api'
import type {
  CategoryFilter,
  CategoryWithUsage,
  DashboardData,
  Debtor,
  FeeMember,
  ImportResult,
  P4xAccount,
  P4xFee,
  PaginatedTransactions,
  PartnerSearchResult,
  SumUpBalance,
} from '@/types/p4x'

export default {
  getDashboard() {
    return api.get<DashboardData>('/p4x/accounts')
  },

  getWarningsPartner(page = 1) {
    return api.get<PaginatedTransactions>('/p4x/warnings/partner', { params: { page } })
  },

  getWarningsCategory(page = 1) {
    return api.get<PaginatedTransactions>('/p4x/warnings/category', { params: { page } })
  },

  createAccount(data: {
    iban: string
    bic: string
    label: string
    init_date: string
    init_balance: number
  }) {
    return api.post<P4xAccount>('/p4x/admin/accounts', data)
  },

  updateAccount(
    id: number,
    data: { iban: string; bic: string; label: string; init_date: string; init_balance: number },
  ) {
    return api.put<P4xAccount>(`/p4x/admin/accounts/${id}`, data)
  },

  deleteAccount(id: number) {
    return api.delete(`/p4x/admin/accounts/${id}`)
  },

  importTransactions(accountId: number, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ImportResult>(`/p4x/admin/accounts/${accountId}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  getTransactionsByMonth(accountId: number, year: number, month: number, page = 1) {
    return api.get<PaginatedTransactions>(
      `/p4x/accounts/${accountId}/transactions/by-month/${year}/${month}`,
      { params: { page } },
    )
  },

  getTransactionsByPartner(accountId: number, type: string, partnerId: number, page = 1) {
    return api.get<PaginatedTransactions>(
      `/p4x/accounts/${accountId}/transactions/by-partner/${type}/${partnerId}`,
      { params: { page } },
    )
  },

  getTransactionsByCategory(accountId: number, categoryId: number, page = 1) {
    return api.get<PaginatedTransactions>(
      `/p4x/accounts/${accountId}/transactions/by-category/${categoryId}`,
      { params: { page } },
    )
  },

  getTransactionsByFilter(accountId: number, filterId: number, page = 1) {
    return api.get<PaginatedTransactions>(
      `/p4x/admin/accounts/${accountId}/transactions/by-filter/${filterId}`,
      { params: { page } },
    )
  },

  getTransactionRaw(accountId: number, transactionId: number) {
    return api.get<{ raw: string }>(`/p4x/accounts/${accountId}/transactions/raw/${transactionId}`)
  },

  getTransactionAttachment(accountId: number, transactionId: number) {
    return api.get(`/p4x/accounts/${accountId}/transactions/attachment/${transactionId}`, {
      responseType: 'blob',
    })
  },

  searchPartners(q: string) {
    return api.get<PartnerSearchResult[]>('/p4x/partner/search', { params: { q } })
  },

  setTransactionPartner(transactionId: number, data: object) {
    return api.post(`/p4x/admin/transactions/${transactionId}/set-partner`, data)
  },

  updateTransaction(transactionId: number, formData: FormData) {
    return api.put(`/p4x/admin/transactions/${transactionId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  getCategories() {
    return api.get<CategoryWithUsage[]>('/p4x/admin/categories')
  },

  createCategory(data: {
    name: string
    label: string
    background_color: string
    text_color: string
  }) {
    return api.post<CategoryWithUsage>('/p4x/admin/categories', data)
  },

  updateCategory(
    id: number,
    data: { name: string; label: string; background_color: string; text_color: string },
  ) {
    return api.put<CategoryWithUsage>(`/p4x/admin/categories/${id}`, data)
  },

  deleteCategory(id: number) {
    return api.delete(`/p4x/admin/categories/${id}`)
  },

  getCategoryFilters() {
    return api.get<CategoryFilter[]>('/p4x/admin/category-filters')
  },

  createCategoryFilter(data: object) {
    return api.post<CategoryFilter>('/p4x/admin/category-filters', data)
  },

  updateCategoryFilter(id: number, data: object) {
    return api.put<CategoryFilter>(`/p4x/admin/category-filters/${id}`, data)
  },

  deleteCategoryFilter(id: number) {
    return api.delete(`/p4x/admin/category-filters/${id}`)
  },

  getFilter2DirectPreview(filterId: number) {
    return api.get(`/p4x/admin/category-filters/${filterId}/filter2direct`)
  },

  processFilter2Direct(filterId: number) {
    return api.post(`/p4x/admin/category-filters/${filterId}/filter2direct`)
  },

  setCategoryDirect(transactionId: number, data: object[]) {
    return api.post(`/p4x/admin/transactions/${transactionId}/set-category-direct`, data)
  },

  unsetCategoryDirect(transactionId: number) {
    return api.delete(`/p4x/admin/transactions/${transactionId}/unset-category-direct`)
  },

  getFeeConfig() {
    return api.get<P4xFee[]>('/p4x/admin/fee-config')
  },

  createFee(data: { year: number; month: number; fee: number }) {
    return api.post<P4xFee[]>('/p4x/admin/fee-config', data)
  },

  deleteFee(start: string) {
    return api.delete<P4xFee[]>(`/p4x/admin/fee-config/${start}`)
  },

  searchFeeMembers(q: string) {
    return api.get<{ data: { id: number; label: string }[] }>('/p4x/fee-members/search', {
      params: { q },
    })
  },

  getFeeMember(id: number) {
    return api.get<FeeMember>(`/p4x/fee-members/${id}`)
  },

  updateFeeMember(id: number, data: object) {
    return api.post<FeeMember>(`/p4x/admin/fee-members/${id}`, data)
  },

  getDebtors() {
    return api.get<Debtor[]>('/p4x/fee-debtors')
  },

  getSumupBalance() {
    return api.get<SumUpBalance>('/p4x/sumup/balance')
  },

  orderSummary(data: { start: string; end: string }) {
    return api.post('/p4x/admin/summary', data, {
      responseType: 'blob',
    })
  },
}
