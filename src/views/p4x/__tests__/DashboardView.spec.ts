import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DashboardView from '../DashboardView.vue'
import PrimeVue from 'primevue/config'
import type { DashboardData, P4xAccount } from '@/types/p4x'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockGetDashboard = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: { getDashboard: (...args: unknown[]) => mockGetDashboard(...args) },
}))

const mockAuthStore: { user: { permissions: string[] } | null } = { user: { permissions: [] } }
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

const stubs = {
  RouterLink: { template: '<a><slot /></a>' },
  TransactionTable: {
    name: 'TransactionTable',
    template: '<div class="transaction-table-stub" />',
    props: ['transactions', 'categories', 'title', 'admin'],
  },
  Menu: {
    name: 'Menu',
    template: '<div />',
    props: ['model', 'popup'],
    methods: { toggle: vi.fn() },
  },
}

function buildAccount(overrides: Partial<P4xAccount> = {}): P4xAccount {
  return {
    id: 1,
    iban: 'AT001234',
    bic: null,
    label: 'Kasse Wien',
    init_date: '2020-01-01',
    init_balance: 0,
    balance: 100,
    transactions_count: 5,
    transactions_latest: new Date().toISOString(),
    ...overrides,
  }
}

function buildDashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    accounts: [buildAccount()],
    warnings_partner: { count: 0, preview: [] },
    warnings_category: { count: 0, preview: [] },
    categories: [],
    ...overrides,
  }
}

function buildMountOpts() {
  return { global: { plugins: [PrimeVue, createPinia()], stubs } }
}

describe('DashboardView (p4x)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user = { permissions: [] }
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('renders the active accounts list with their balances once loaded', async () => {
    mockGetDashboard.mockResolvedValue({ data: buildDashboard() })
    const wrapper = mount(DashboardView, buildMountOpts())
    await flushPromises()

    expect(wrapper.text()).toContain('Kasse Wien')
    wrapper.unmount()
  })

  it('treats accounts without a transactions_latest date as inactive and hides them by default', async () => {
    mockGetDashboard.mockResolvedValue({
      data: buildDashboard({
        accounts: [buildAccount({ id: 2, label: 'Altkonto', transactions_latest: null })],
      }),
    })
    const wrapper = mount(DashboardView, buildMountOpts())
    await flushPromises()

    expect(wrapper.text()).not.toContain('Altkonto')
    expect(wrapper.find('.inactive-toggle').exists()).toBe(true)
    wrapper.unmount()
  })

  it('treats accounts whose last transaction is older than 730 days as inactive', async () => {
    mockGetDashboard.mockResolvedValue({
      data: buildDashboard({
        accounts: [buildAccount({ id: 2, label: 'Altkonto', transactions_latest: '2000-01-01' })],
      }),
    })
    const wrapper = mount(DashboardView, buildMountOpts())
    await flushPromises()

    expect(wrapper.text()).not.toContain('Altkonto')
    wrapper.unmount()
  })

  it('shows inactive accounts once the toggle link is clicked', async () => {
    mockGetDashboard.mockResolvedValue({
      data: buildDashboard({
        accounts: [buildAccount({ id: 2, label: 'Altkonto', transactions_latest: null })],
      }),
    })
    const wrapper = mount(DashboardView, buildMountOpts())
    await flushPromises()

    await wrapper.find('.toggle-link').trigger('click')

    expect(wrapper.text()).toContain('Altkonto')
    expect(wrapper.text()).toContain('verberge')
    wrapper.unmount()
  })

  it('does not show the create-account link for non-admins', async () => {
    mockGetDashboard.mockResolvedValue({ data: buildDashboard() })
    const wrapper = mount(DashboardView, buildMountOpts())
    await flushPromises()

    expect(wrapper.find('.create-link').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the create-account link for admins', async () => {
    mockAuthStore.user = { permissions: ['p4xAdmin'] }
    mockGetDashboard.mockResolvedValue({ data: buildDashboard() })
    const wrapper = mount(DashboardView, buildMountOpts())
    await flushPromises()

    expect(wrapper.find('.create-link').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not render a warnings section when both warning counts are zero', async () => {
    mockGetDashboard.mockResolvedValue({ data: buildDashboard() })
    const wrapper = mount(DashboardView, buildMountOpts())
    await flushPromises()

    expect(wrapper.find('.warnings-section').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders one TransactionTable per non-zero warning category with the matching title', async () => {
    mockGetDashboard.mockResolvedValue({
      data: buildDashboard({
        warnings_partner: { count: 2, preview: [] },
        warnings_category: { count: 0, preview: [] },
      }),
    })
    const wrapper = mount(DashboardView, buildMountOpts())
    await flushPromises()

    const tables = wrapper.findAllComponents({ name: 'TransactionTable' })
    expect(tables).toHaveLength(1)
    expect(tables[0]!.props('title')).toContain('ohne Partner (2)')
    wrapper.unmount()
  })

  it('reloads only the warnings data when the refresh button is clicked', async () => {
    mockGetDashboard.mockResolvedValueOnce({
      data: buildDashboard({ warnings_partner: { count: 1, preview: [] } }),
    })
    const wrapper = mount(DashboardView, buildMountOpts())
    await flushPromises()

    mockGetDashboard.mockResolvedValueOnce({
      data: buildDashboard({ warnings_partner: { count: 3, preview: [] } }),
    })
    await wrapper.find('.warnings-section .pi-refresh').trigger('click')
    await flushPromises()

    expect(mockGetDashboard).toHaveBeenCalledTimes(2)
    const table = wrapper.findComponent({ name: 'TransactionTable' })
    expect(table.props('title')).toContain('ohne Partner (3)')
    wrapper.unmount()
  })

  it('builds admin-only menu items (Filter, Administration) only for admins', async () => {
    mockGetDashboard.mockResolvedValue({ data: buildDashboard() })
    const wrapper = mount(DashboardView, buildMountOpts())
    await flushPromises()

    const nonAdminItems = wrapper.findComponent({ name: 'Menu' }).props('model') as Array<{
      label: string
    }>
    expect(nonAdminItems.map((g) => g.label)).not.toContain('Administration')
    wrapper.unmount()
  })

  it('adds Filter and Administration menu groups for admins', async () => {
    mockAuthStore.user = { permissions: ['p4xAdmin'] }
    mockGetDashboard.mockResolvedValue({ data: buildDashboard() })
    const wrapper = mount(DashboardView, buildMountOpts())
    await flushPromises()

    const items = wrapper.findComponent({ name: 'Menu' }).props('model') as Array<{
      label: string
      items?: Array<{ label: string }>
    }>
    expect(items.map((g) => g.label)).toContain('Administration')
    expect(items[0]!.items!.map((i) => i.label)).toContain('Filter')
    wrapper.unmount()
  })

  it('navigates to the monthly transactions view from a menu command', async () => {
    mockGetDashboard.mockResolvedValue({
      data: buildDashboard({ accounts: [buildAccount({ id: 9 })] }),
    })
    const wrapper = mount(DashboardView, buildMountOpts())
    await flushPromises()

    const items = wrapper.findComponent({ name: 'Menu' }).props('model') as Array<{
      items: Array<{ label: string; command: () => void }>
    }>
    items[0]!.items.find((i) => i.label === 'Monat')!.command()

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'p4x-transactions-month',
        params: expect.objectContaining({ accountId: 9 }),
      }),
    )
    wrapper.unmount()
  })
})
