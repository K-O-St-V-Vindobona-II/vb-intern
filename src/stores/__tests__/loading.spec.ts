import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLoadingStore } from '../loading'

describe('Loading Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with no active requests', () => {
    const store = useLoadingStore()
    expect(store.activeRequests).toBe(0)
    expect(store.isLoading).toBe(false)
  })

  it('should set isLoading when request starts', () => {
    const store = useLoadingStore()
    store.startLoading()
    expect(store.activeRequests).toBe(1)
    expect(store.isLoading).toBe(true)
  })

  it('should clear isLoading when all requests finish', () => {
    const store = useLoadingStore()
    store.startLoading()
    store.stopLoading()
    expect(store.activeRequests).toBe(0)
    expect(store.isLoading).toBe(false)
  })

  it('should track multiple concurrent requests', () => {
    const store = useLoadingStore()
    store.startLoading()
    store.startLoading()
    store.startLoading()
    expect(store.activeRequests).toBe(3)
    expect(store.isLoading).toBe(true)

    store.stopLoading()
    expect(store.activeRequests).toBe(2)
    expect(store.isLoading).toBe(true)

    store.stopLoading()
    store.stopLoading()
    expect(store.activeRequests).toBe(0)
    expect(store.isLoading).toBe(false)
  })

  it('should not go below zero', () => {
    const store = useLoadingStore()
    store.stopLoading()
    store.stopLoading()
    expect(store.activeRequests).toBe(0)
    expect(store.isLoading).toBe(false)
  })
})
