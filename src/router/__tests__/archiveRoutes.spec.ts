import { describe, it, expect } from 'vitest'
import router from '@/router'

const ID = '0198f2a4-7b1c-7a3e-8d21-5f6a9c1e2b34'

describe('archive routes', () => {
  it.each([
    ['archive-dir', `/archive/dirs/${ID}`],
    ['archive-file', `/archive/files/${ID}`],
  ])('resolves %s for a UUID', (name, path) => {
    const resolved = router.resolve(path)

    expect(resolved.name).toBe(name)
    expect(resolved.params['id']).toBe(ID)
  })

  it('keeps the root and the upload page reachable', () => {
    expect(router.resolve('/archive').name).toBe('archive-root')
    expect(router.resolve('/archive/upload').name).toBe('archive-upload')
  })

  it.each([
    ['dirs', 'an encoded path traversal', '..%2F..%2Fauth%2Fsessions'],
    ['files', 'an encoded path traversal', '..%2F..%2Fauth%2Fsessions'],
    ['dirs', 'an encoded dot segment', '%2e%2e'],
    ['files', 'a number', '42'],
    ['dirs', 'a UUID with a suffix', `${ID}%2Fpurge`],
    ['files', 'a UUID with a short last group', ID.slice(0, -1)],
  ])('does not resolve /archive/%s/ for %s', (kind, _label, id) => {
    const resolved = router.resolve(`/archive/${kind}/${id}`)

    expect(resolved.name).toBe('not-found')
  })
})
