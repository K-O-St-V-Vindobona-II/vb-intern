import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ExportView from '../ExportView.vue'
import exportViewSource from '../ExportView.vue?raw'
import PrimeVue from 'primevue/config'

const buildExportConfig = () => ({
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

const buildDownload = () => ({
  data: new Blob(['test']),
  headers: { 'content-disposition': 'attachment; filename=mailing-liste_2026-06-23.txt' },
})

const mockGetExportConfig = vi.fn()
const mockDownloadExport = vi.fn()
vi.mock('@/services/standesdbService', () => ({
  default: {
    getExportConfig: (...args: unknown[]) => mockGetExportConfig(...args),
    downloadExport: (...args: unknown[]) => mockDownloadExport(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockCreateObjectURL = vi.fn(() => 'blob:mock')
const mockRevokeObjectURL = vi.fn()

const mountView = async () => {
  const w = mount(ExportView, { global: { plugins: [PrimeVue] } })
  await flushPromises()
  return w
}

const findButton = (w: ReturnType<typeof mount>, text: string) =>
  w.findAll('button').find((b) => b.text() === text)!

describe('ExportView', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetExportConfig.mockReset()
    mockDownloadExport.mockReset()
    mockGetExportConfig.mockResolvedValue(buildExportConfig())
    mockDownloadExport.mockResolvedValue(buildDownload())
    // jsdom implements neither the object-URL functions nor the navigation a click on a
    // download link would trigger.
    URL.createObjectURL = mockCreateObjectURL
    URL.revokeObjectURL = mockRevokeObjectURL
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    clickSpy.mockRestore()
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
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

    await findButton(w, 'VBW').trigger('click')

    const checkboxes = w.findAllComponents({ name: 'Checkbox' })
    await checkboxes[6]!.vm.$emit('update:modelValue', true) // include_disabled_delivery

    await findButton(w, 'Export starten').trigger('click')
    await flushPromises()

    expect(mockDownloadExport).toHaveBeenCalledWith({
      module: 'mailing-liste',
      selections: {
        vbw_fu: true,
        vbn_fu: false,
        vbw_bu: true,
        vbn_bu: false,
        vbw_contacts: false,
        vbn_contacts: false,
      },
      include_disabled_delivery: true,
      include_dead: false,
      include_common_contacts: false,
      only_without_email: false,
    })
  })

  it('uses the filename from the content-disposition header', async () => {
    const w = await mountView()

    await findButton(w, 'Export starten').trigger('click')
    await flushPromises()

    expect(mockCreateObjectURL).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Export erstellt',
        detail: 'mailing-liste_2026-06-23.txt wurde heruntergeladen.',
      }),
    )
  })

  it('regression: reads the name from a quoted header that also carries the RFC 5987 form', async () => {
    mockDownloadExport.mockResolvedValue({
      data: new Blob(['x']),
      headers: {
        'content-disposition':
          'attachment; filename="excel-liste-komplett_2026-09-25.xlsx"; filename*=UTF-8\'\'excel-liste-komplett_2026-09-25.xlsx',
      },
    })
    const w = await mountView()

    await findButton(w, 'Export starten').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: 'excel-liste-komplett_2026-09-25.xlsx wurde heruntergeladen.',
      }),
    )
  })

  it('falls back to a generated filename without a content-disposition header', async () => {
    mockDownloadExport.mockResolvedValueOnce({ data: new Blob(['x']), headers: {} })

    const w = await mountView()
    await findButton(w, 'Export starten').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: expect.stringMatching(/export_\d{4}-\d{2}-\d{2}/) }),
    )
  })

  it('shows an error toast when the export fails', async () => {
    mockDownloadExport.mockRejectedValueOnce(new Error('boom'))
    const w = await mountView()

    await findButton(w, 'Export starten').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Export fehlgeschlagen.' }),
    )
  })

  it('does not start a second export while one is running', async () => {
    let releaseExport: (value: unknown) => void = () => {}
    mockDownloadExport.mockReturnValueOnce(new Promise((resolve) => (releaseExport = resolve)))
    const w = await mountView()

    await findButton(w, 'Export starten').trigger('click')
    await findButton(w, 'Export starten').trigger('click')
    releaseExport(buildDownload())
    await flushPromises()

    expect(mockDownloadExport).toHaveBeenCalledTimes(1)
  })

  it('toggles all states (but not contacts) for an org via the org preset button', async () => {
    const w = await mountView()
    const vbwButton = findButton(w, 'VBW')

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
    const fuxLink = w.findAll('.matrix-link').find((b) => b.text() === 'Fux')!

    await fuxLink.trigger('click')
    const checkboxes = w.findAllComponents({ name: 'Checkbox' })
    // Fux is the first row: vbw_fu (index 0) and vbn_fu (index 1) should be on.
    expect(checkboxes[0]!.props('modelValue')).toBe(true)
    expect(checkboxes[1]!.props('modelValue')).toBe(true)
  })

  it('toggles contacts across all orgs via the preset button and the matrix link', async () => {
    const w = await mountView()

    await findButton(w, 'Kontakte').trigger('click')
    let checkboxes = w.findAllComponents({ name: 'Checkbox' })
    expect(checkboxes[4]!.props('modelValue')).toBe(true) // vbw_contacts
    expect(checkboxes[5]!.props('modelValue')).toBe(true) // vbn_contacts

    const kontakteLink = w.findAll('.matrix-link').find((b) => b.text() === 'Kontakte')!
    await kontakteLink.trigger('click')
    checkboxes = w.findAllComponents({ name: 'Checkbox' })
    expect(checkboxes[4]!.props('modelValue')).toBe(false)
    expect(checkboxes[5]!.props('modelValue')).toBe(false)
  })

  describe('a load that fails', () => {
    it('regression: says so instead of showing a bare heading', async () => {
      mockGetExportConfig.mockRejectedValue({ response: { status: 500 } })

      const w = await mountView()

      expect(w.text()).toContain('Die Export-Einstellungen konnten nicht geladen werden.')
      expect(w.text()).not.toContain('Export starten')
    })

    it('loads the settings after "Erneut versuchen"', async () => {
      mockGetExportConfig.mockRejectedValueOnce({ response: { status: 500 } })
      const w = await mountView()

      await findButton(w, 'Erneut versuchen').trigger('click')
      await flushPromises()

      expect(w.text()).toContain('Export starten')
      expect(w.text()).not.toContain('konnten nicht geladen werden')
    })
  })

  describe('keyboard and assistive technology', () => {
    it('regression: offers the matrix row toggles as buttons', async () => {
      const w = await mountView()

      const toggles = w.findAll('.matrix-link')

      expect(toggles.map((t) => t.element.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON'])
      expect(toggles.map((t) => t.text())).toEqual(['Fux', 'Bursch', 'Kontakte'])
      expect(w.findAll('a')).toHaveLength(0)
    })

    it('regression: names every matrix checkbox by its row and its org', async () => {
      const w = await mountView()

      const names = w
        .findAll('.matrix-table input[type="checkbox"]')
        .map((i) => i.attributes('aria-label'))

      expect(names).toEqual([
        'Fux VBW',
        'Fux VBN',
        'Bursch VBW',
        'Bursch VBN',
        'Kontakte VBW',
        'Kontakte VBN',
      ])
    })

    it('regression: labels the format select by the title of its step', async () => {
      const w = await mountView()

      const title = w.find('#export-format-title')

      expect(w.find('.module-select [aria-labelledby="export-format-title"]').exists()).toBe(true)
      expect(title.text()).toContain('Export-Format')
      const badges = w.findAll('.step-badge')
      expect(badges).toHaveLength(3)
      expect(badges.every((b) => b.attributes('aria-hidden') === 'true')).toBe(true)
    })
  })

  it('regression: the step badge takes its text colour from the theme, not from a fixed white', () => {
    // A fixed #fff on --p-primary-color is 1.9:1 in the dark scheme (light green primary); the
    // contrast token of the theme flips to the dark surface colour there.
    const badgeRule = /\.step-badge\s*\{[^}]*\}/.exec(exportViewSource)?.[0] ?? ''

    expect(badgeRule).toContain('color: var(--p-primary-contrast-color)')
    expect(badgeRule).not.toMatch(/color:\s*#(?:fff|ffffff)\b/i)
  })
})
