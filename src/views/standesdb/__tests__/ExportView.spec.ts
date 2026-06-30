import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ExportView from '../ExportView.vue'
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

const mockGetExportConfig = vi.fn().mockResolvedValue({
  data: {
    modules: [
      { id: 'mailing-liste', label: 'Mailing-Liste' },
      { id: 'excel-liste-komplett', label: 'Excel-Liste (komplett)' },
    ],
    orgs: [
      { id: 'vbw', label: 'VBW', order: 1 },
      { id: 'vbn', label: 'VBN', order: 2 },
    ],
    states: [
      { id: 'fu', label: 'Fux', order: 1 },
      { id: 'bu', label: 'Bursch', order: 2 },
    ],
    flags: {
      include_disabled_delivery: 'Deaktivierte Zustellung einbeziehen',
      include_dead: 'Verstorbene einbeziehen',
      include_common_contacts: 'Allgemeine Kontakte einbeziehen',
      only_without_email: 'Nur ohne E-Mail',
    },
  },
})

const mockDownloadExport = vi.fn().mockResolvedValue({
  data: new Blob(['test']),
  headers: { 'content-disposition': 'attachment; filename=mailing-liste_2026-06-23.txt' },
})

vi.mock('@/services/standesdbService', () => ({
  default: {
    getExportConfig: (...args: unknown[]) => mockGetExportConfig(...args),
    downloadExport: (...args: unknown[]) => mockDownloadExport(...args),
  },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { permissions: ['standesdbExport'] },
    token: 'test-token',
  })),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/standesdb/export', name: 'standesdb-export', component: ExportView }],
})

const mountView = async () => {
  await router.push('/standesdb/export')
  await router.isReady()
  const w = mount(ExportView, {
    global: {
      plugins: [PrimeVue, ToastService, router, createPinia()],
    },
  })
  await flushPromises()
  await vi.dynamicImportSettled()
  return w
}

describe('ExportView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGetExportConfig.mockClear()
    mockDownloadExport.mockClear()
  })

  it('renders page title', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Standesdatenbank')
    expect(w.text()).toContain('Export')
  })

  it('renders three step cards', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Export-Format')
    expect(w.text()).toContain('Daten auswählen')
    expect(w.text()).toContain('Optionen')
  })

  it('renders preset buttons', async () => {
    const w = await mountView()
    const buttons = w.findAll('button')
    const labels = buttons.map((b) => b.text())
    expect(labels).toContain('VBW')
    expect(labels).toContain('VBN')
    expect(labels).toContain('Kontakte')
  })

  it('renders matrix with states and kontakte', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Fux')
    expect(w.text()).toContain('Bursch')
    expect(w.text()).toContain('Kontakte')
    expect(w.text()).toContain('VBW')
    expect(w.text()).toContain('VBN')
  })

  it('renders flag options', async () => {
    const w = await mountView()
    expect(w.text()).toContain('deaktivierter Zustellung')
    expect(w.text()).toContain('Verstorbene Mitglieder')
    expect(w.text()).toContain('Allgemeine Kontakte')
    expect(w.text()).toContain('ohne E-Mail')
  })

  it('renders export button', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Export starten')
  })

  it('calls getExportConfig on mount', async () => {
    await mountView()
    expect(mockGetExportConfig).toHaveBeenCalled()
  })
})
