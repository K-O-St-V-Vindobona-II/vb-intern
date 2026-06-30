import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { useP4xStore } from '@/stores/p4x'

describe('P4x Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
  })

  it('should initialize with showInactive false when sessionStorage is empty', () => {
    const store = useP4xStore()
    expect(store.showInactive).toBe(false)
  })

  it('should hydrate showInactive from sessionStorage when set to "true"', () => {
    sessionStorage.setItem('p4x-showInactive', 'true')
    const store = useP4xStore()
    expect(store.showInactive).toBe(true)
  })

  it('should keep showInactive false for any non-"true" sessionStorage value', () => {
    sessionStorage.setItem('p4x-showInactive', 'false')
    const store = useP4xStore()
    expect(store.showInactive).toBe(false)
  })

  it('should toggle showInactive and persist the new value', () => {
    const store = useP4xStore()

    store.toggleInactive()
    expect(store.showInactive).toBe(true)
    expect(sessionStorage.getItem('p4x-showInactive')).toBe('true')

    store.toggleInactive()
    expect(store.showInactive).toBe(false)
    expect(sessionStorage.getItem('p4x-showInactive')).toBe('false')
  })
})
