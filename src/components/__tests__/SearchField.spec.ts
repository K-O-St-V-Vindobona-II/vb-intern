import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SearchField from '../SearchField.vue'
import type { SearchResult } from '../SearchField.vue'
import PrimeVue from 'primevue/config'

function buildResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return { id: 1, label: 'Max Mustermann', ...overrides }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

function deferredResults() {
  let resolvePromise!: (value: SearchResult[]) => void
  const promise = new Promise<SearchResult[]>((resolve) => {
    resolvePromise = resolve
  })
  return { promise, resolve: resolvePromise }
}

describe('SearchField', () => {
  it('does not search below the default minimum length', async () => {
    const searchFn = vi.fn()
    const wrapper = mount(SearchField, { props: { searchFn }, ...mountOpts })

    const ac = wrapper.findComponent({ name: 'AutoComplete' })
    await ac.vm.$emit('complete', { query: 'Ma' })
    await flushPromises()

    expect(searchFn).not.toHaveBeenCalled()
    expect(ac.props('suggestions')).toEqual([])
    wrapper.unmount()
  })

  it('searches and shows suggestions once the minimum length is reached', async () => {
    const results = [buildResult()]
    const searchFn = vi.fn().mockResolvedValue(results)
    const wrapper = mount(SearchField, { props: { searchFn }, ...mountOpts })

    const ac = wrapper.findComponent({ name: 'AutoComplete' })
    await ac.vm.$emit('complete', { query: 'Max' })
    await flushPromises()

    expect(searchFn).toHaveBeenCalledWith('Max')
    expect(wrapper.findComponent({ name: 'AutoComplete' }).props('suggestions')).toEqual(results)
    wrapper.unmount()
  })

  it('respects a custom minLength prop', async () => {
    const searchFn = vi.fn().mockResolvedValue([])
    const wrapper = mount(SearchField, {
      props: { searchFn, minLength: 1 },
      ...mountOpts,
    })

    const ac = wrapper.findComponent({ name: 'AutoComplete' })
    expect(ac.props('minLength')).toBe(1)

    await ac.vm.$emit('complete', { query: 'M' })
    await flushPromises()

    expect(searchFn).toHaveBeenCalledWith('M')
    wrapper.unmount()
  })

  it('clears suggestions when the search fails', async () => {
    const searchFn = vi.fn().mockRejectedValue(new Error('boom'))
    const wrapper = mount(SearchField, { props: { searchFn }, ...mountOpts })

    const ac = wrapper.findComponent({ name: 'AutoComplete' })
    await ac.vm.$emit('complete', { query: 'Max' })
    await flushPromises()

    expect(wrapper.findComponent({ name: 'AutoComplete' }).props('suggestions')).toEqual([])
    wrapper.unmount()
  })

  it('emits select and resets the query when an item is chosen', async () => {
    const searchFn = vi.fn().mockResolvedValue([buildResult()])
    const wrapper = mount(SearchField, { props: { searchFn }, ...mountOpts })

    const ac = wrapper.findComponent({ name: 'AutoComplete' })
    await ac.vm.$emit('complete', { query: 'Max' })
    await flushPromises()
    await ac.vm.$emit('item-select', { value: buildResult({ id: 7 }) })

    expect(wrapper.emitted('select')).toEqual([[buildResult({ id: 7 })]])
    expect(wrapper.findComponent({ name: 'AutoComplete' }).props('modelValue')).toBe('')
    wrapper.unmount()
  })

  it('uses the default placeholder and minLength when none are given', () => {
    const wrapper = mount(SearchField, {
      props: { searchFn: vi.fn() },
      ...mountOpts,
    })

    const ac = wrapper.findComponent({ name: 'AutoComplete' })
    expect(ac.props('placeholder')).toBe('Suchen (mind. 3 Zeichen)...')
    expect(ac.props('minLength')).toBe(3)
    wrapper.unmount()
  })

  it('uses a custom placeholder when given', () => {
    const wrapper = mount(SearchField, {
      props: { searchFn: vi.fn(), placeholder: 'Mitglied suchen...' },
      ...mountOpts,
    })

    expect(wrapper.findComponent({ name: 'AutoComplete' }).props('placeholder')).toBe(
      'Mitglied suchen...',
    )
    wrapper.unmount()
  })

  it('focuses the input on mount', async () => {
    const wrapper = mount(SearchField, {
      props: { searchFn: vi.fn() },
      ...mountOpts,
    })
    await flushPromises()

    expect(document.activeElement?.tagName).toBe('INPUT')
    wrapper.unmount()
  })

  it('clears suggestions from an earlier search when the query drops below the minimum', async () => {
    const searchFn = vi.fn().mockResolvedValue([buildResult()])
    const wrapper = mount(SearchField, { props: { searchFn }, ...mountOpts })
    const ac = wrapper.findComponent({ name: 'AutoComplete' })

    await ac.vm.$emit('complete', { query: 'Max' })
    await flushPromises()
    expect(ac.props('suggestions')).toHaveLength(1)

    await ac.vm.$emit('complete', { query: 'Ma' })
    await flushPromises()

    expect(ac.props('suggestions')).toEqual([])
    wrapper.unmount()
  })

  it('regression: a slow answer for an outdated query does not replace the newer suggestions', async () => {
    const slow = deferredResults()
    const fast = deferredResults()
    const searchFn = vi.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise)
    const wrapper = mount(SearchField, { props: { searchFn }, ...mountOpts })
    const ac = wrapper.findComponent({ name: 'AutoComplete' })

    await ac.vm.$emit('complete', { query: 'Max' })
    await ac.vm.$emit('complete', { query: 'Maxi' })
    fast.resolve([buildResult({ id: 2, label: 'Maxi Muster' })])
    await flushPromises()
    slow.resolve([buildResult({ id: 1, label: 'Max Mustermann' })])
    await flushPromises()

    expect(ac.props('suggestions')).toEqual([buildResult({ id: 2, label: 'Maxi Muster' })])
    wrapper.unmount()
  })

  it('regression: a late failure of an outdated query does not clear the newer suggestions', async () => {
    let rejectSlow!: (reason: Error) => void
    const slow = new Promise<SearchResult[]>((_, reject) => {
      rejectSlow = reject
    })
    const searchFn = vi
      .fn()
      .mockReturnValueOnce(slow)
      .mockResolvedValueOnce([buildResult({ id: 2, label: 'Maxi Muster' })])
    const wrapper = mount(SearchField, { props: { searchFn }, ...mountOpts })
    const ac = wrapper.findComponent({ name: 'AutoComplete' })

    await ac.vm.$emit('complete', { query: 'Max' })
    await ac.vm.$emit('complete', { query: 'Maxi' })
    await flushPromises()
    rejectSlow(new Error('offline'))
    await flushPromises()

    expect(ac.props('suggestions')).toEqual([buildResult({ id: 2, label: 'Maxi Muster' })])
    wrapper.unmount()
  })

  it('regression: an answer that arrives after the query fell below the minimum is discarded', async () => {
    const pending = deferredResults()
    const searchFn = vi.fn().mockReturnValueOnce(pending.promise)
    const wrapper = mount(SearchField, { props: { searchFn }, ...mountOpts })
    const ac = wrapper.findComponent({ name: 'AutoComplete' })

    await ac.vm.$emit('complete', { query: 'Max' })
    await ac.vm.$emit('complete', { query: 'Ma' })
    pending.resolve([buildResult()])
    await flushPromises()

    expect(ac.props('suggestions')).toEqual([])
    wrapper.unmount()
  })

  it('names the enforced minimum in the default placeholder', () => {
    const wrapper = mount(SearchField, {
      props: { searchFn: vi.fn(), minLength: 1 },
      ...mountOpts,
    })

    expect(wrapper.findComponent({ name: 'AutoComplete' }).props('placeholder')).toBe(
      'Suchen (mind. 1 Zeichen)...',
    )
    wrapper.unmount()
  })
})
