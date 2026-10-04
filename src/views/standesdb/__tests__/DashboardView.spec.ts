import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import DashboardView from '../DashboardView.vue'
import SearchField from '@/components/SearchField.vue'
import PrimeVue from 'primevue/config'

const MEMBER_ID = '11111111-1111-1111-1111-111111111111'
const CONTACT_ID = '22222222-2222-2222-2222-222222222222'

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: { user: null as { permissions: string[] } | null },
}))
const reactiveAuth = reactive(mockAuth)
vi.mock('@/stores/auth', () => ({ useAuthStore: () => reactiveAuth }))

const mockGetStats = vi.fn()
const mockSearch = vi.fn()
vi.mock('@/services/standesdbService', () => ({
  default: {
    getStats: (...args: unknown[]) => mockGetStats(...args),
    search: (...args: unknown[]) => mockSearch(...args),
  },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
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

function buildStats() {
  return {
    data: {
      member: {
        present: { vbw: 5, vbn: 2 },
        dismissed: { vbw: 1 },
        dead: { vbw: 3, vbn: 4 },
        dismissed_dead: {},
      },
      contact: { common: 3, vbw: 1, vbn: 0 },
    },
  }
}

async function mountView() {
  await router.push('/standesdb')
  await router.isReady()
  const w = mount(DashboardView, { global: { plugins: [PrimeVue, router] } })
  await flushPromises()
  return w
}

const findButton = (w: ReturnType<typeof mount>, text: string) =>
  w.findAll('button').find((b) => b.text() === text)

describe('DashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetStats.mockReset()
    mockSearch.mockReset()
    mockGetStats.mockResolvedValue(buildStats())
    mockSearch.mockResolvedValue({ data: { data: [] } })
    reactiveAuth.user = { permissions: [] }
  })

  it('renders the page title and the search field', async () => {
    const w = await mountView()

    expect(w.text()).toContain('Standesdatenbank')
    expect(w.findComponent(SearchField).exists()).toBe(true)
  })

  describe('statistics', () => {
    it('shows one row per member status and one column per organisation', async () => {
      const w = await mountView()

      const [memberTable] = w.findAll('table')
      const headers = memberTable!.findAll('th').map((th) => th.text())
      const rows = memberTable!
        .findAll('tbody tr')
        .map((tr) => tr.findAll('td').map((td) => td.text()))

      expect(headers).toEqual(['Status', 'VBW', 'VBN'])
      expect(rows).toEqual([
        ['Aktiv', '5', '2'],
        ['Entlassen', '1', '0'],
        ['Verstorben', '3', '4'],
        ['Entl. & Verst.', '0', '0'],
      ])
    })

    it('shows the contact counts by category', async () => {
      const w = await mountView()

      const contactTable = w.findAll('table')[1]!
      const rows = contactTable
        .findAll('tbody tr')
        .map((tr) => tr.findAll('td').map((td) => td.text()))

      expect(rows).toEqual([
        ['Allgemein', '3'],
        ['VBW', '1'],
        ['VBN', '0'],
      ])
    })

    it('regression: says so when the statistics cannot be loaded, and keeps the search', async () => {
      mockGetStats.mockRejectedValue({ response: { status: 500 } })

      const w = await mountView()

      expect(w.text()).toContain('Die Statistik konnte nicht geladen werden.')
      expect(w.findAll('table')).toHaveLength(0)
      expect(w.findComponent(SearchField).exists()).toBe(true)
    })

    it('loads the statistics after "Erneut versuchen"', async () => {
      mockGetStats.mockRejectedValueOnce({ response: { status: 500 } })
      const w = await mountView()

      await findButton(w, 'Erneut versuchen')!.trigger('click')
      await flushPromises()

      expect(w.findAll('table')).toHaveLength(2)
      expect(w.text()).not.toContain('konnte nicht geladen werden')
    })
  })

  describe('create buttons', () => {
    it.each([
      [[], false, false],
      [['standesdbVbwAdmin'], true, false],
      [['standesdbVbnAdmin'], true, false],
      [['standesdbContactAdmin'], false, true],
      [['standesdbVbwAdmin', 'standesdbContactAdmin'], true, true],
    ])(
      'permissions %j show member button: %s, contact button: %s',
      async (permissions, member, contact) => {
        reactiveAuth.user = { permissions }

        const w = await mountView()

        expect(findButton(w, 'Neues Mitglied') !== undefined).toBe(member)
        expect(findButton(w, 'Neuer Kontakt') !== undefined).toBe(contact)
      },
    )

    it('regression: shows the buttons once the permissions arrive after the page was opened', async () => {
      reactiveAuth.user = null
      const w = await mountView()
      expect(findButton(w, 'Neues Mitglied')).toBeUndefined()

      reactiveAuth.user = { permissions: ['standesdbVbnAdmin', 'standesdbContactAdmin'] }
      await flushPromises()

      expect(findButton(w, 'Neues Mitglied')).toBeDefined()
      expect(findButton(w, 'Neuer Kontakt')).toBeDefined()
    })

    it('opens the create pages', async () => {
      reactiveAuth.user = { permissions: ['standesdbVbwAdmin', 'standesdbContactAdmin'] }
      const w = await mountView()

      await findButton(w, 'Neues Mitglied')!.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('standesdb-member-new')

      await router.push('/standesdb')
      await findButton(w, 'Neuer Kontakt')!.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('standesdb-contact-new')
    })
  })

  describe('search', () => {
    it('asks the API and hands its results to the field', async () => {
      const results = [{ type: 'member', id: MEMBER_ID, label: 'Max Mustermann' }]
      mockSearch.mockResolvedValue({ data: { data: results } })
      const w = await mountView()

      const searchFn = w.findComponent(SearchField).props('searchFn')

      await expect(searchFn('Muster')).resolves.toEqual(results)
      expect(mockSearch).toHaveBeenCalledWith('Muster')
    })

    it.each([
      ['member', MEMBER_ID, 'standesdb-member-show'],
      ['contact', CONTACT_ID, 'standesdb-contact-show'],
    ])('opens the %s page of the chosen result', async (type, id, routeName) => {
      const w = await mountView()

      w.findComponent(SearchField).vm.$emit('select', { type, id, label: 'Treffer' })
      await flushPromises()

      expect(router.currentRoute.value.name).toBe(routeName)
      expect(router.currentRoute.value.params['id']).toBe(id)
    })

    it('regression: ignores a result of an unknown kind instead of opening a contact page for it', async () => {
      const w = await mountView()

      w.findComponent(SearchField).vm.$emit('select', {
        type: 'archive',
        id: MEMBER_ID,
        label: 'Treffer',
      })
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('standesdb-dashboard')
    })
  })
})
