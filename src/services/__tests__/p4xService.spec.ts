import { describe, it, expect, vi, beforeEach } from 'vitest'
import p4xService from '@/services/p4xService'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()
vi.mock('@/services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

describe('p4xService', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
  })

  it('getDashboard fetches /p4x/accounts', () => {
    p4xService.getDashboard()
    expect(mockGet).toHaveBeenCalledWith('/p4x/accounts')
  })

  it('getWarningsPartner defaults to page 1', () => {
    p4xService.getWarningsPartner()
    expect(mockGet).toHaveBeenCalledWith('/p4x/warnings/partner', { params: { page: 1 } })
  })

  it('getWarningsPartner forwards a custom page', () => {
    p4xService.getWarningsPartner(3)
    expect(mockGet).toHaveBeenCalledWith('/p4x/warnings/partner', { params: { page: 3 } })
  })

  it('getWarningsCategory defaults to page 1', () => {
    p4xService.getWarningsCategory()
    expect(mockGet).toHaveBeenCalledWith('/p4x/warnings/category', { params: { page: 1 } })
  })

  it('createAccount posts the account payload', () => {
    const data = {
      iban: 'AT00',
      bic: 'BIC',
      label: 'Kasse',
      init_date: '2026-01-01',
      init_balance: 0,
    }
    p4xService.createAccount(data)
    expect(mockPost).toHaveBeenCalledWith('/p4x/admin/accounts', data)
  })

  it('updateAccount puts the account payload', () => {
    const data = {
      iban: 'AT00',
      bic: 'BIC',
      label: 'Kasse',
      init_date: '2026-01-01',
      init_balance: 0,
    }
    p4xService.updateAccount(5, data)
    expect(mockPut).toHaveBeenCalledWith('/p4x/admin/accounts/5', data)
  })

  it('deleteAccount deletes the account', () => {
    p4xService.deleteAccount(5)
    expect(mockDelete).toHaveBeenCalledWith('/p4x/admin/accounts/5')
  })

  it('importTransactions sends a multipart form with the file', () => {
    const file = new File(['x'], 'export.csv')
    p4xService.importTransactions(5, file)
    expect(mockPost).toHaveBeenCalledWith('/p4x/admin/accounts/5/import', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const formData = mockPost.mock.calls[0][1] as FormData
    expect(formData.get('file')).toBe(file)
  })

  it('getTransactionsByMonth builds the year/month path', () => {
    p4xService.getTransactionsByMonth(5, 2026, 6, 2)
    expect(mockGet).toHaveBeenCalledWith('/p4x/accounts/5/transactions/by-month/2026/6', {
      params: { page: 2 },
    })
  })

  it('getTransactionsByPartner builds the type/partner path', () => {
    p4xService.getTransactionsByPartner(5, 'member', 9)
    expect(mockGet).toHaveBeenCalledWith('/p4x/accounts/5/transactions/by-partner/member/9', {
      params: { page: 1 },
    })
  })

  it('getTransactionsByCategory builds the category path', () => {
    p4xService.getTransactionsByCategory(5, 2)
    expect(mockGet).toHaveBeenCalledWith('/p4x/accounts/5/transactions/by-category/2', {
      params: { page: 1 },
    })
  })

  it('getTransactionsByFilter builds the admin filter path', () => {
    p4xService.getTransactionsByFilter(5, 4)
    expect(mockGet).toHaveBeenCalledWith('/p4x/admin/accounts/5/transactions/by-filter/4', {
      params: { page: 1 },
    })
  })

  it('getTransactionRaw fetches the raw transaction', () => {
    p4xService.getTransactionRaw(5, 11)
    expect(mockGet).toHaveBeenCalledWith('/p4x/accounts/5/transactions/raw/11')
  })

  it('getTransactionAttachment requests a blob response', () => {
    p4xService.getTransactionAttachment(5, 11)
    expect(mockGet).toHaveBeenCalledWith('/p4x/accounts/5/transactions/attachment/11', {
      responseType: 'blob',
    })
  })

  it('searchPartners forwards the query', () => {
    p4xService.searchPartners('Verein')
    expect(mockGet).toHaveBeenCalledWith('/p4x/partner/search', { params: { q: 'Verein' } })
  })

  it('setTransactionPartner posts the partner assignment', () => {
    const data = { partner_id: 9 }
    p4xService.setTransactionPartner(11, data)
    expect(mockPost).toHaveBeenCalledWith('/p4x/admin/transactions/11/set-partner', data)
  })

  it('updateTransaction puts a multipart form', () => {
    const formData = new FormData()
    p4xService.updateTransaction(11, formData)
    expect(mockPut).toHaveBeenCalledWith('/p4x/admin/transactions/11', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  })

  it('getCategories fetches admin categories', () => {
    p4xService.getCategories()
    expect(mockGet).toHaveBeenCalledWith('/p4x/admin/categories')
  })

  it('createCategory posts the category payload', () => {
    const data = { name: 'spende', label: 'Spende', background_color: '#fff', text_color: '#000' }
    p4xService.createCategory(data)
    expect(mockPost).toHaveBeenCalledWith('/p4x/admin/categories', data)
  })

  it('updateCategory puts the category payload', () => {
    const data = { name: 'spende', label: 'Spende', background_color: '#fff', text_color: '#000' }
    p4xService.updateCategory(2, data)
    expect(mockPut).toHaveBeenCalledWith('/p4x/admin/categories/2', data)
  })

  it('deleteCategory deletes the category', () => {
    p4xService.deleteCategory(2)
    expect(mockDelete).toHaveBeenCalledWith('/p4x/admin/categories/2')
  })

  it('getCategoryFilters fetches admin category filters', () => {
    p4xService.getCategoryFilters()
    expect(mockGet).toHaveBeenCalledWith('/p4x/admin/category-filters')
  })

  it('createCategoryFilter posts the filter payload', () => {
    const data = { pattern: 'foo' }
    p4xService.createCategoryFilter(data)
    expect(mockPost).toHaveBeenCalledWith('/p4x/admin/category-filters', data)
  })

  it('updateCategoryFilter puts the filter payload', () => {
    const data = { pattern: 'bar' }
    p4xService.updateCategoryFilter(4, data)
    expect(mockPut).toHaveBeenCalledWith('/p4x/admin/category-filters/4', data)
  })

  it('deleteCategoryFilter deletes the filter', () => {
    p4xService.deleteCategoryFilter(4)
    expect(mockDelete).toHaveBeenCalledWith('/p4x/admin/category-filters/4')
  })

  it('getFilter2DirectPreview fetches the preview', () => {
    p4xService.getFilter2DirectPreview(4)
    expect(mockGet).toHaveBeenCalledWith('/p4x/admin/category-filters/4/filter2direct')
  })

  it('processFilter2Direct posts to apply the filter', () => {
    p4xService.processFilter2Direct(4)
    expect(mockPost).toHaveBeenCalledWith('/p4x/admin/category-filters/4/filter2direct')
  })

  it('setCategoryDirect posts the direct category assignments', () => {
    const data = [{ category_id: 1 }]
    p4xService.setCategoryDirect(11, data)
    expect(mockPost).toHaveBeenCalledWith('/p4x/admin/transactions/11/set-category-direct', data)
  })

  it('unsetCategoryDirect deletes the direct category assignment', () => {
    p4xService.unsetCategoryDirect(11)
    expect(mockDelete).toHaveBeenCalledWith('/p4x/admin/transactions/11/unset-category-direct')
  })

  it('getFeeConfig fetches the fee configuration', () => {
    p4xService.getFeeConfig()
    expect(mockGet).toHaveBeenCalledWith('/p4x/admin/fee-config')
  })

  it('createFee posts a new fee entry', () => {
    const data = { year: 2026, month: 6, fee: 10 }
    p4xService.createFee(data)
    expect(mockPost).toHaveBeenCalledWith('/p4x/admin/fee-config', data)
  })

  it('deleteFee deletes the fee entry by start date', () => {
    p4xService.deleteFee('2026-06')
    expect(mockDelete).toHaveBeenCalledWith('/p4x/admin/fee-config/2026-06')
  })

  it('searchFeeMembers forwards the query', () => {
    p4xService.searchFeeMembers('Max')
    expect(mockGet).toHaveBeenCalledWith('/p4x/fee-members/search', { params: { q: 'Max' } })
  })

  it('getFeeMember fetches a single fee member', () => {
    p4xService.getFeeMember(8)
    expect(mockGet).toHaveBeenCalledWith('/p4x/fee-members/8')
  })

  it('updateFeeMember posts the updated fee member', () => {
    const data = { fee_override: 5 }
    p4xService.updateFeeMember(8, data)
    expect(mockPost).toHaveBeenCalledWith('/p4x/admin/fee-members/8', data)
  })

  it('getDebtors fetches the debtors list', () => {
    p4xService.getDebtors()
    expect(mockGet).toHaveBeenCalledWith('/p4x/fee-debtors')
  })

  it('getSumupBalance fetches the SumUp balance', () => {
    p4xService.getSumupBalance()
    expect(mockGet).toHaveBeenCalledWith('/p4x/sumup/balance')
  })

  it('orderSummary posts the date range and requests a blob', () => {
    const data = { start: '2026-01-01', end: '2026-06-30' }
    p4xService.orderSummary(data)
    expect(mockPost).toHaveBeenCalledWith('/p4x/admin/summary', data, { responseType: 'blob' })
  })
})
