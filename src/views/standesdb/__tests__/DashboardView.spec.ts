import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DashboardView from '../DashboardView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('@/services/standesdbService', () => ({
  default: {
    getStats: vi.fn().mockResolvedValue({
      data: {
        member: { present: { vbw: 5, vbn: 2 }, dismissed: {}, dead: {}, dismissed_dead: {} },
        contact: { common: 3, vbw: 1, vbn: 0 },
      },
    }),
    search: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/standesdb', name: 'standesdb-dashboard', component: DashboardView },
    {
      path: '/standesdb/members/new',
      name: 'standesdb-member-new',
      component: { template: '<div />' },
    },
    {
      path: '/standesdb/contacts/new',
      name: 'standesdb-contact-new',
      component: { template: '<div />' },
    },
    {
      path: '/standesdb/members/:id',
      name: 'standesdb-member-show',
      component: { template: '<div />' },
    },
    {
      path: '/standesdb/contacts/:id',
      name: 'standesdb-contact-show',
      component: { template: '<div />' },
    },
  ],
})

describe('DashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the page title', async () => {
    await router.push('/standesdb')
    await router.isReady()
    const w = mount(DashboardView, {
      global: {
        plugins: [PrimeVue, ToastService, router, createPinia()],
      },
    })
    await vi.dynamicImportSettled()
    expect(w.text()).toContain('Standesdatenbank')
  })

  it('renders search input', async () => {
    await router.push('/standesdb')
    await router.isReady()
    const w = mount(DashboardView, {
      global: {
        plugins: [PrimeVue, ToastService, router, createPinia()],
      },
    })
    expect(w.find('.search-input').exists() || w.find('input').exists()).toBe(true)
  })
})
