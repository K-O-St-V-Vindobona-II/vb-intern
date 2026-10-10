import { describe, it, expect } from 'vitest'
import router from '@/router'

const ID = '0198f2a4-7b1c-7a3e-8d21-5f6a9c1e2b34'

describe('p4x routes with an id in the API path', () => {
  it.each([
    ['p4x-transactions-partner', `/p4x/accounts/${ID}/transactions/by-partner`, 'accountId'],
    ['p4x-transactions-category', `/p4x/accounts/${ID}/transactions/by-category`, 'accountId'],
    ['p4x-transactions-filter', `/p4x/admin/accounts/${ID}/transactions/by-filter`, 'accountId'],
    ['p4x-account-import', `/p4x/admin/accounts/${ID}/import`, 'accountId'],
    ['p4x-account-edit', `/p4x/admin/accounts/${ID}/edit`, 'id'],
    ['p4x-category-edit', `/p4x/admin/categories/${ID}/edit`, 'id'],
    ['p4x-filter-edit', `/p4x/admin/category-filters/${ID}/edit`, 'id'],
    ['p4x-filter2direct', `/p4x/admin/category-filters/${ID}/filter2direct`, 'id'],
    ['p4x-fee-member', `/p4x/fee-members/${ID}`, 'id'],
    ['p4x-fee-member-edit', `/p4x/fee-members/${ID}/edit`, 'id'],
  ])('resolves %s for a UUID', (name, path, param) => {
    const resolved = router.resolve(path)

    expect(resolved.name).toBe(name)
    expect(resolved.params[param]).toBe(ID)
  })

  it('keeps the optional fee-member id optional and the static siblings reachable', () => {
    expect(router.resolve('/p4x/fee-members').name).toBe('p4x-fee-member')
    expect(router.resolve('/p4x/admin/accounts/new').name).toBe('p4x-account-new')
    expect(router.resolve('/p4x/admin/categories/new').name).toBe('p4x-category-new')
    expect(router.resolve('/p4x/admin/category-filters/new').name).toBe('p4x-filter-new')
  })

  it.each([
    [
      '/p4x/accounts/..%2F..%2Fauth%2Fsessions/transactions/by-partner',
      'an encoded path traversal',
    ],
    ['/p4x/accounts/%2e%2e/transactions/by-category', 'an encoded dot segment'],
    ['/p4x/admin/accounts/..%2Fx/transactions/by-filter', 'an encoded path traversal'],
    ['/p4x/admin/accounts/..%2Fx/edit', 'an encoded path traversal'],
    ['/p4x/admin/categories/..%2Fx/edit', 'an encoded path traversal'],
    ['/p4x/admin/category-filters/..%2Fx/edit', 'an encoded path traversal'],
    ['/p4x/admin/category-filters/..%2Fx/filter2direct', 'an encoded path traversal'],
    ['/p4x/fee-members/..%2Fx', 'an encoded path traversal'],
    ['/p4x/fee-members/..%2Fx/edit', 'an encoded path traversal'],
    ['/p4x/admin/accounts/42/import', 'a number'],
    [`/p4x/admin/accounts/${ID}%2Fdelete/edit`, 'a UUID with a suffix'],
    ['/p4x/fee-members/..%2F..%2Fauth%2Fsessions', 'an encoded path traversal'],
  ])('does not resolve %s (%s)', (path) => {
    expect(router.resolve(path).name).toBe('not-found')
  })
})

describe('p4x by-month route', () => {
  const monthPath = (accountId: string, year: string, month: string) =>
    `/p4x/accounts/${accountId}/transactions/by-month/${year}/${month}`

  it('resolves a UUID account with a valid year and month and keeps both as strings', () => {
    const resolved = router.resolve(monthPath(ID, '2026', '6'))

    expect(resolved.name).toBe('p4x-transactions-month')
    expect(resolved.params).toMatchObject({ accountId: ID, year: '2026', month: '6' })
  })

  it.each([
    ['2000', '1'],
    ['2100', '12'],
    ['2026', '06'],
    ['2026', '12'],
  ])('accepts the year %s and the month %s', (year, month) => {
    expect(router.resolve(monthPath(ID, year, month)).name).toBe('p4x-transactions-month')
  })

  it.each([
    ['1999', '6', 'a year before the supported range'],
    ['2101', '6', 'a year after the supported range'],
    ['99999999999999', '6', 'a year too large for a Date'],
    ['0', '6', 'a year of zero'],
    ['2026', '0', 'a month of zero'],
    ['2026', '13', 'a month above twelve'],
    ['2026', '006', 'a month with too many leading zeros'],
  ])('does not resolve the year %s with the month %s (%s)', (year, month) => {
    expect(router.resolve(monthPath(ID, year, month)).name).toBe('not-found')
  })

  it('does not resolve an account id that is not a UUID', () => {
    expect(router.resolve(monthPath('..%2Fx', '2026', '6')).name).toBe('not-found')
    expect(router.resolve(monthPath('2', '2026', '6')).name).toBe('not-found')
  })
})
