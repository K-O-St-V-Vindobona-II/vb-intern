import { describe, it, expect } from 'vitest'
import router from '@/router'

const ID = '0198f2a4-7b1c-7a3e-8d21-5f6a9c1e2b34'

describe('standesdb routes with an id in the API path', () => {
  it.each([
    ['standesdb-change-request-review', `/standesdb/change-requests/${ID}`],
    ['standesdb-contact-show', `/standesdb/contacts/${ID}`],
    ['standesdb-contact-edit', `/standesdb/contacts/${ID}/edit`],
    ['standesdb-contact-images', `/standesdb/contacts/${ID}/images`],
    ['standesdb-member-images', `/standesdb/members/${ID}/images`],
    ['standesdb-member-show', `/standesdb/members/${ID}`],
    ['standesdb-member-edit', `/standesdb/members/${ID}/edit`],
  ])('resolves %s for a UUID', (name, path) => {
    const resolved = router.resolve(path)

    expect(resolved.name).toBe(name)
    expect(resolved.params['id']).toBe(ID)
  })

  it('keeps the static siblings reachable', () => {
    expect(router.resolve('/standesdb/contacts/new').name).toBe('standesdb-contact-new')
    expect(router.resolve('/standesdb/members/new').name).toBe('standesdb-member-new')
    expect(router.resolve('/standesdb/members/me/images').name).toBe('standesdb-my-images')
    expect(router.resolve('/standesdb/change-requests').name).toBe('standesdb-change-requests')
  })

  it.each([
    ['/standesdb/change-requests/..%2F..%2Fauth%2Fsessions', 'an encoded path traversal'],
    ['/standesdb/contacts/..%2F..%2Fauth%2Fsessions', 'an encoded path traversal'],
    ['/standesdb/contacts/..%2F..%2Fauth%2Fsessions/edit', 'an encoded path traversal'],
    ['/standesdb/contacts/%2e%2e/images', 'an encoded dot segment'],
    ['/standesdb/members/..%2F..%2Fauth%2Fsessions/images', 'an encoded path traversal'],
    ['/standesdb/members/..%2F..%2Fauth%2Fsessions', 'an encoded path traversal'],
    ['/standesdb/members/..%2F..%2Fauth%2Fsessions/edit', 'an encoded path traversal'],
    ['/standesdb/members/1', 'a number'],
    ['/standesdb/contacts/42', 'a number'],
    [`/standesdb/change-requests/${ID}%2Fdecide`, 'a UUID with a suffix'],
  ])('does not resolve %s (%s)', (path) => {
    expect(router.resolve(path).name).toBe('not-found')
  })
})
