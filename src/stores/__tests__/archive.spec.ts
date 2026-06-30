import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { useArchiveStore } from '@/stores/archive'

describe('Archive Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
  })

  it('should initialize with an empty clipboard when sessionStorage is empty', () => {
    const store = useArchiveStore()
    expect(store.clipboard).toEqual([])
    expect(store.showAdmin).toBe(false)
  })

  it('should hydrate the clipboard from sessionStorage on creation', () => {
    sessionStorage.setItem('archive-clipboard', JSON.stringify(['a', 'b']))
    const store = useArchiveStore()
    expect(store.clipboard).toEqual(['a', 'b'])
  })

  it('should fall back to an empty clipboard when sessionStorage holds invalid JSON', () => {
    sessionStorage.setItem('archive-clipboard', '{not valid json')
    const store = useArchiveStore()
    expect(store.clipboard).toEqual([])
  })

  it('should add items to the clipboard and persist them, deduplicating via Set', () => {
    const store = useArchiveStore()
    store.addToClipboard(['a', 'b'])
    store.addToClipboard(['b', 'c'])

    expect(store.clipboard).toEqual(['a', 'b', 'c'])
    expect(JSON.parse(sessionStorage.getItem('archive-clipboard') ?? '[]')).toEqual(['a', 'b', 'c'])
  })

  it('should remove items from the clipboard and persist the change', () => {
    const store = useArchiveStore()
    store.addToClipboard(['a', 'b', 'c'])

    store.removeFromClipboard(['b'])

    expect(store.clipboard).toEqual(['a', 'c'])
    expect(JSON.parse(sessionStorage.getItem('archive-clipboard') ?? '[]')).toEqual(['a', 'c'])
  })

  it('should empty the clipboard and persist the change', () => {
    const store = useArchiveStore()
    store.addToClipboard(['a', 'b'])

    store.emptyClipboard()

    expect(store.clipboard).toEqual([])
    expect(JSON.parse(sessionStorage.getItem('archive-clipboard') ?? '[]')).toEqual([])
  })
})
