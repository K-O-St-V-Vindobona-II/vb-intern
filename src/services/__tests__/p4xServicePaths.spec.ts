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

describe('p4xService path encoding', () => {
  const RAW = 'a/../b?c#d'
  const ENC = 'a%2F..%2Fb%3Fc%23d'
  const data = {}
  const formData = new FormData()
  const file = new File(['x'], 'x.csv')

  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
  })

  it.each([
    [
      'getTransactionsByMonth',
      () => p4xService.getTransactionsByMonth(RAW, 2026, 6),
      mockGet,
      `/p4x/accounts/${ENC}/transactions/by-month/2026/6`,
    ],
    [
      'getTransactionsByPartner',
      () => p4xService.getTransactionsByPartner(RAW, RAW, RAW),
      mockGet,
      `/p4x/accounts/${ENC}/transactions/by-partner/${ENC}/${ENC}`,
    ],
    [
      'getTransactionsByCategory',
      () => p4xService.getTransactionsByCategory(RAW, RAW),
      mockGet,
      `/p4x/accounts/${ENC}/transactions/by-category/${ENC}`,
    ],
    [
      'getTransactionsByFilter',
      () => p4xService.getTransactionsByFilter(RAW, RAW),
      mockGet,
      `/p4x/admin/accounts/${ENC}/transactions/by-filter/${ENC}`,
    ],
    [
      'getTransactionRaw',
      () => p4xService.getTransactionRaw(RAW, RAW),
      mockGet,
      `/p4x/accounts/${ENC}/transactions/raw/${ENC}`,
    ],
    [
      'getTransactionAttachment',
      () => p4xService.getTransactionAttachment(RAW, RAW),
      mockGet,
      `/p4x/accounts/${ENC}/transactions/attachment/${ENC}`,
    ],
    [
      'getFilter2DirectPreview',
      () => p4xService.getFilter2DirectPreview(RAW),
      mockGet,
      `/p4x/admin/category-filters/${ENC}/filter2direct`,
    ],
    ['getFeeMember', () => p4xService.getFeeMember(RAW), mockGet, `/p4x/fee-members/${ENC}`],
    [
      'exportFeeMember',
      () => p4xService.exportFeeMember(RAW),
      mockGet,
      `/p4x/fee-members/${ENC}/export`,
    ],
    [
      'importTransactions',
      () => p4xService.importTransactions(RAW, file),
      mockPost,
      `/p4x/admin/accounts/${ENC}/import`,
    ],
    [
      'setTransactionPartner',
      () => p4xService.setTransactionPartner(RAW, data),
      mockPost,
      `/p4x/admin/transactions/${ENC}/set-partner`,
    ],
    [
      'setCategoryDirect',
      () => p4xService.setCategoryDirect(RAW, []),
      mockPost,
      `/p4x/admin/transactions/${ENC}/set-category-direct`,
    ],
    [
      'processFilter2Direct',
      () => p4xService.processFilter2Direct(RAW),
      mockPost,
      `/p4x/admin/category-filters/${ENC}/filter2direct`,
    ],
    [
      'updateFeeMember',
      () => p4xService.updateFeeMember(RAW, data),
      mockPost,
      `/p4x/admin/fee-members/${ENC}`,
    ],
    [
      'updateAccount',
      () =>
        p4xService.updateAccount(RAW, {
          iban: '',
          bic: '',
          label: '',
          init_date: '',
          init_balance: 0,
        }),
      mockPut,
      `/p4x/admin/accounts/${ENC}`,
    ],
    [
      'updateCategory',
      () =>
        p4xService.updateCategory(RAW, {
          name: '',
          label: '',
          background_color: '',
          text_color: '',
        }),
      mockPut,
      `/p4x/admin/categories/${ENC}`,
    ],
    [
      'updateCategoryFilter',
      () => p4xService.updateCategoryFilter(RAW, data),
      mockPut,
      `/p4x/admin/category-filters/${ENC}`,
    ],
    [
      'updateTransaction',
      () => p4xService.updateTransaction(RAW, formData),
      mockPut,
      `/p4x/admin/transactions/${ENC}`,
    ],
    [
      'deleteAccount',
      () => p4xService.deleteAccount(RAW),
      mockDelete,
      `/p4x/admin/accounts/${ENC}`,
    ],
    [
      'deleteCategory',
      () => p4xService.deleteCategory(RAW),
      mockDelete,
      `/p4x/admin/categories/${ENC}`,
    ],
    [
      'deleteCategoryFilter',
      () => p4xService.deleteCategoryFilter(RAW),
      mockDelete,
      `/p4x/admin/category-filters/${ENC}`,
    ],
    [
      'unsetCategoryDirect',
      () => p4xService.unsetCategoryDirect(RAW),
      mockDelete,
      `/p4x/admin/transactions/${ENC}/unset-category-direct`,
    ],
    ['deleteFee', () => p4xService.deleteFee(RAW), mockDelete, `/p4x/admin/fee-config/${ENC}`],
  ])('%s encodes every identifier it puts into the path', (_name, call, mock, expectedPath) => {
    call()

    expect(mock.mock.calls[0]![0]).toBe(expectedPath)
  })
})
