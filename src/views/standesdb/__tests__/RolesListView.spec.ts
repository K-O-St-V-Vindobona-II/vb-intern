import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RolesListView from '../RolesListView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { createRouter, createMemoryHistory } from 'vue-router'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const mockGetRolesList = vi.fn().mockResolvedValue({
  data: {
    semester: 'ws',
    year: 2025,
    roles: [
      {
        label: 'Senior',
        group: 'chc',
        vbw: { id: 1, cn: 'Max Muster', startdate: '2025-08-01', enddate: '2026-01-31' },
        vbn: null,
      },
      {
        label: 'Consenior',
        group: 'chc',
        vbw: null,
        vbn: { id: 2, cn: 'Anna Test', startdate: '2025-08-01', enddate: '2026-01-31' },
      },
      { label: 'Philistersenior', group: 'philchc', vbw: null, vbn: null },
      {
        label: 'Archivar',
        group: 'funktion',
        vbw: { id: 3, cn: 'Fritz Archivar', startdate: '2020-01-01', enddate: null },
        vbn: null,
      },
      { label: 'VG-Vorsitz', group: 'verbindungsgericht', vbw: null, vbn: null },
    ],
  },
})

vi.mock('@/services/standesdbService', () => ({
  default: {
    getRolesList: (...args: unknown[]) => mockGetRolesList(...args),
  },
}))

const createTestRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/standesdb/roles', name: 'standesdb-roles', component: RolesListView },
      {
        path: '/standesdb/roles/:year/:semester',
        name: 'standesdb-roles-semester',
        component: RolesListView,
      },
      {
        path: '/standesdb/members/:id',
        name: 'standesdb-member-show',
        component: { template: '<div />' },
      },
    ],
  })

const mountView = async (path = '/standesdb/roles') => {
  const router = createTestRouter()
  await router.push(path)
  await router.isReady()
  const w = mount(RolesListView, {
    global: {
      plugins: [PrimeVue, ToastService, router, createPinia()],
    },
  })
  await flushPromises()
  await vi.dynamicImportSettled()
  return { wrapper: w, router }
}

describe('RolesListView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGetRolesList.mockClear()
  })

  it('renders page title and subtitle', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Standesdatenbank')
    expect(wrapper.text()).toContain('Liste aller Chargen und Funktionen')
  })

  it('displays semester heading', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Wintersemester 2025')
  })

  it('calls API without params on default route', async () => {
    await mountView()
    expect(mockGetRolesList).toHaveBeenCalledWith(undefined)
  })

  it('calls API with params when mounted on semester route', async () => {
    await mountView('/standesdb/roles/2024/ss')
    expect(mockGetRolesList).toHaveBeenCalledWith({
      year: 2024,
      semester: 'ss',
    })
  })

  it('renders chc section with member names', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Chargenkabinett')
    expect(wrapper.text()).toContain('Max Muster')
    expect(wrapper.text()).toContain('Anna Test')
  })

  it('renders philchc section', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Philister-Chargenkabinett')
  })

  it('renders funktionen section with type column', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Funktionen, Kommissionen, Gericht')
    expect(wrapper.text()).toContain('Fritz Archivar')
    expect(wrapper.text()).toContain('Funktion')
  })

  it('renders member names as clickable links', async () => {
    const { wrapper } = await mountView()
    const links = wrapper.findAll('.member-link')
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].text()).toContain('Max Muster')
  })

  it('navigates to semester URL when semester selected', async () => {
    const { wrapper, router } = await mountView()
    mockGetRolesList.mockClear()

    const buttons = wrapper.findAll('button')
    const semesterBtn = buttons.find((b) => b.text().includes('Semester auswählen'))
    await semesterBtn!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('standesdb-roles-semester')
    expect(router.currentRoute.value.params).toEqual({ year: '2025', semester: 'ws' })
    expect(mockGetRolesList).toHaveBeenCalledWith({ year: 2025, semester: 'ws' })
  })

  it('navigates to default URL when current button clicked', async () => {
    const { wrapper, router } = await mountView('/standesdb/roles/2024/ss')
    mockGetRolesList.mockClear()

    const buttons = wrapper.findAll('button')
    const currentBtn = buttons.find((b) => b.text().includes('Aktuelle Vertretung'))
    await currentBtn!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('standesdb-roles')
    expect(mockGetRolesList).toHaveBeenCalledWith(undefined)
  })

  it('reloads data when route params change via back navigation', async () => {
    const { router } = await mountView('/standesdb/roles/2024/ss')
    mockGetRolesList.mockClear()

    await router.push('/standesdb/roles/2023/ws')
    await flushPromises()

    expect(mockGetRolesList).toHaveBeenCalledWith({ year: 2023, semester: 'ws' })
  })
})
