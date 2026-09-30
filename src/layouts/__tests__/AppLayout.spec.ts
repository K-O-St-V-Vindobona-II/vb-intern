import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '@/layouts/AppLayout.vue'
import { useLoadingStore } from '@/stores/loading'

vi.mock('vue-router', () => ({
  RouterView: { template: '<div data-test="router-view" />' },
}))

vi.mock('@/components/layout/AppNavbar.vue', () => ({
  default: { template: '<nav data-test="navbar" />' },
}))

function mountLayout() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(AppLayout, { global: { plugins: [pinia] } })
  return { wrapper, loadingStore: useLoadingStore() }
}

describe('AppLayout.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the navbar in the header and the routed view in the main area', () => {
    const { wrapper } = mountLayout()

    expect(wrapper.find('header [data-test="navbar"]').exists()).toBe(true)
    expect(wrapper.find('main [data-test="router-view"]').exists()).toBe(true)
  })

  it('shows the global loading bar only while requests are active', async () => {
    const { wrapper, loadingStore } = mountLayout()
    expect(wrapper.find('.global-loading-bar').exists()).toBe(false)

    loadingStore.startLoading()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.global-loading-bar').exists()).toBe(true)

    loadingStore.stopLoading()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.global-loading-bar').exists()).toBe(false)
  })

  // jsdom computes no layout, so the sticky header is guarded at the source
  // level: a scroll-container overflow value on the layout root makes the
  // sticky header resolve against a box that never scrolls, and the header
  // then scrolls away with the page.
  it('keeps the sticky header working: the layout root creates no scroll container', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'AppLayout.vue'),
      'utf-8',
    )
    const rootRule = /\.layout-container\s*\{([^}]*)\}/.exec(source)?.[1] ?? ''

    expect(rootRule).not.toBe('')
    expect(rootRule).not.toMatch(/overflow(-x|-y)?\s*:\s*(hidden|auto|scroll)/)
  })
})
