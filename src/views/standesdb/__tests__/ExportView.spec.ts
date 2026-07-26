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

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
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
    mockToastAdd.mockClear()
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

  // Checkbox render order (row-major DataTable + flags section):
  // 0=vbw_fu 1=vbn_fu 2=vbw_bu 3=vbn_bu 4=vbw_contacts 5=vbn_contacts
  // 6=include_disabled_delivery 7=include_dead 8=include_common_contacts 9=only_without_email

  it('exports with the selected module, matrix selections and flags', async () => {
    const w = await mountView()

    const vbwButton = w.findAll('button').find((b) => b.text() === 'VBW')!
    await vbwButton.trigger('click')

    const checkboxes = w.findAllComponents({ name: 'Checkbox' })
    await checkboxes[6]!.vm.$emit('update:modelValue', true) // include_disabled_delivery

    const exportButton = w.findAll('button').find((b) => b.text() === 'Export starten')!
    await exportButton.trigger('click')
    await flushPromises()

    expect(mockDownloadExport).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'mailing-liste',
        selections: expect.objectContaining({ vbw_fu: true, vbw_bu: true }),
        include_disabled_delivery: true,
      }),
    )
  })

  it('uses the filename from the content-disposition header', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const w = await mountView()
    const exportButton = w.findAll('button').find((b) => b.text() === 'Export starten')!
    await exportButton.trigger('click')
    await flushPromises()

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Export erstellt' }),
    )

    clickSpy.mockRestore()
  })

  it('falls back to a generated filename without a content-disposition header', async () => {
    mockDownloadExport.mockResolvedValueOnce({ data: new Blob(['x']), headers: {} })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const w = await mountView()
    const exportButton = w.findAll('button').find((b) => b.text() === 'Export starten')!
    await exportButton.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: expect.stringMatching(/export_\d{4}-\d{2}-\d{2}/) }),
    )
    clickSpy.mockRestore()
  })

  it('shows an error toast when the export fails', async () => {
    mockDownloadExport.mockRejectedValueOnce(new Error('boom'))
    const w = await mountView()

    const exportButton = w.findAll('button').find((b) => b.text() === 'Export starten')!
    await exportButton.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Export fehlgeschlagen.' }),
    )
  })

  it('toggles all states (but not contacts) for an org via the org preset button', async () => {
    const w = await mountView()
    const vbwButton = w.findAll('button').find((b) => b.text() === 'VBW')!

    await vbwButton.trigger('click')
    let checkboxes = w.findAllComponents({ name: 'Checkbox' })
    expect(checkboxes[0]!.props('modelValue')).toBe(true) // vbw_fu
    expect(checkboxes[2]!.props('modelValue')).toBe(true) // vbw_bu
    expect(checkboxes[4]!.props('modelValue')).toBe(false) // vbw_contacts untouched
    expect(checkboxes[1]!.props('modelValue')).toBe(false) // vbn_fu untouched

    await vbwButton.trigger('click')
    checkboxes = w.findAllComponents({ name: 'Checkbox' })
    expect(checkboxes[0]!.props('modelValue')).toBe(false)
    expect(checkboxes[2]!.props('modelValue')).toBe(false)
  })

  it('toggles a single state across all orgs via the matrix link', async () => {
    const w = await mountView()
    const fuxLink = w.findAll('a').find((a) => a.text() === 'Fux')!

    await fuxLink.trigger('click')
    const checkboxes = w.findAllComponents({ name: 'Checkbox' })
    // Fux is the first row: vbw_fu (index 0) and vbn_fu (index 1) should be on.
    expect(checkboxes[0]!.props('modelValue')).toBe(true)
    expect(checkboxes[1]!.props('modelValue')).toBe(true)
  })

  it('toggles contacts across all orgs via the preset button and the matrix link', async () => {
    const w = await mountView()
    const kontakteButton = w.findAll('button').find((b) => b.text() === 'Kontakte')!

    await kontakteButton.trigger('click')
    let checkboxes = w.findAllComponents({ name: 'Checkbox' })
    expect(checkboxes[4]!.props('modelValue')).toBe(true) // vbw_contacts
    expect(checkboxes[5]!.props('modelValue')).toBe(true) // vbn_contacts

    const kontakteLink = w.findAll('a').find((a) => a.text() === 'Kontakte')!
    await kontakteLink.trigger('click')
    checkboxes = w.findAllComponents({ name: 'Checkbox' })
    expect(checkboxes[4]!.props('modelValue')).toBe(false)
    expect(checkboxes[5]!.props('modelValue')).toBe(false)
  })
})
