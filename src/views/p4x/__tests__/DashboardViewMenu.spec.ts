import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { routerKey } from 'vue-router'
import router from '@/router'
import DashboardView from '../DashboardView.vue'
import type { DashboardData } from '@/types/p4x'

const ACCOUNT_ID = '0198f2a4-7b1c-7a3e-8d21-5f6a9c1e2b34'

vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: vi.fn() })),
}))

const mockGetDashboard = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: { getDashboard: (...args: unknown[]) => mockGetDashboard(...args) },
}))

const mockAuthStore: { user: { permissions: string[] } | null } = {
  user: { permissions: ['p4xAdmin'] },
}
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

const dashboard: DashboardData = {
  accounts: [
    {
      id: ACCOUNT_ID,
      iban: 'AT001234',
      bic: null,
      label: 'Kasse Wien',
      init_date: '2020-01-01',
      init_balance: 0,
      balance: 100,
      transactions_count: 5,
      transactions_latest: new Date().toISOString(),
    },
  ],
  warnings_partner: { count: 0, preview: [] },
  warnings_category: { count: 0, preview: [] },
  categories: [],
}

const stubs = {
  RouterLink: { template: '<a><slot /></a>' },
  Menu: {
    name: 'Menu',
    template: '<div />',
    props: ['model', 'popup'],
    methods: { toggle: vi.fn() },
  },
}

type MenuGroup = { label: string; items: Array<{ label: string; command: () => void }> }

// The menu pushes route names into a router that this spec does not start or navigate
// (it is provided, not installed): the real router only resolves them, so a renamed or mistyped route name fails here
// instead of throwing when someone clicks the entry.
describe('DashboardView account menu', () => {
  const push = vi.spyOn(router, 'push')

  beforeEach(() => {
    vi.clearAllMocks()
    push.mockResolvedValue(undefined)
    mockAuthStore.user = { permissions: ['p4xAdmin'] }
    mockGetDashboard.mockResolvedValue({ data: dashboard })
  })

  it.each([
    [
      'Monat',
      'p4x-transactions-month',
      { accountId: ACCOUNT_ID, year: String(new Date().getFullYear()) },
    ],
    ['Partner', 'p4x-transactions-partner', { accountId: ACCOUNT_ID }],
    ['Kategorie', 'p4x-transactions-category', { accountId: ACCOUNT_ID }],
    ['Filter', 'p4x-transactions-filter', { accountId: ACCOUNT_ID }],
    ['Bearbeiten', 'p4x-account-edit', { id: ACCOUNT_ID }],
    ['Transaktionen importieren', 'p4x-account-import', { accountId: ACCOUNT_ID }],
  ])('the entry "%s" leads to the existing route %s', async (label, routeName, params) => {
    const wrapper = mount(DashboardView, {
      global: {
        plugins: [PrimeVue, createPinia()],
        provide: { [routerKey as symbol]: router },
        stubs,
      },
    })
    await flushPromises()
    const groups = wrapper.findComponent({ name: 'Menu' }).props('model') as MenuGroup[]
    const entry = groups.flatMap((g) => g.items).find((i) => i.label === label)!

    entry.command()

    const target = push.mock.calls.at(-1)![0]
    const resolved = router.resolve(target)
    expect(resolved.name).toBe(routeName)
    expect(resolved.params).toMatchObject(params)
    wrapper.unmount()
  })

  it('offers the Monat, Partner and Kategorie entries to a viewer without admin rights', async () => {
    mockAuthStore.user = { permissions: ['p4xView'] }
    const wrapper = mount(DashboardView, {
      global: {
        plugins: [PrimeVue, createPinia()],
        provide: { [routerKey as symbol]: router },
        stubs,
      },
    })
    await flushPromises()

    const groups = wrapper.findComponent({ name: 'Menu' }).props('model') as MenuGroup[]

    expect(groups.flatMap((g) => g.items).map((i) => i.label)).toEqual([
      'Monat',
      'Partner',
      'Kategorie',
    ])
    wrapper.unmount()
  })
})
