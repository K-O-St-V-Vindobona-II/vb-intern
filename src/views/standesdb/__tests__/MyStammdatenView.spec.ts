import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MyStammdatenView from '../MyStammdatenView.vue'
import PrimeVue from 'primevue/config'
import type { MemberSelfServiceDetail, MyChangeRequest } from '@/types/standesdb'

function buildSelfServiceDetail(
  overrides: Partial<MemberSelfServiceDetail> = {},
): MemberSelfServiceDetail {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    cn: 'Max Mustermann',
    vortitel: null,
    vorname: 'Max',
    nachname: 'Mustermann',
    nachname_geburt: null,
    nachtitel: null,
    couleurname: 'Testikus',
    email: 'max@verein.at',
    url: null,
    mkv_ogv_url: null,
    rufnummer_mobil: null,
    rufnummer_privat: null,
    rufnummer_beruf: null,
    zustellungen: 'deaktiviert',
    adresse_privat_anschrift: null,
    adresse_privat_plz: null,
    adresse_privat_ort: null,
    adresse_privat_land: null,
    adresse_beruf_anschrift: null,
    adresse_beruf_plz: null,
    adresse_beruf_ort: null,
    adresse_beruf_land: null,
    arbeitgeber: null,
    taetigkeit: null,
    mitgliedschaften: null,
    verbandchargen: null,
    ...overrides,
  }
}

const mockGetMySelfServiceData = vi.fn()
const mockGetMyChangeRequest = vi.fn()
const mockSubmitMyChangeRequest = vi.fn()
vi.mock('@/services/standesdbService', () => ({
  default: {
    getMySelfServiceData: (...args: unknown[]) => mockGetMySelfServiceData(...args),
    getMyChangeRequest: (...args: unknown[]) => mockGetMyChangeRequest(...args),
    submitMyChangeRequest: (...args: unknown[]) => mockSubmitMyChangeRequest(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockAuthStore: { user: { org_id: string } | null } = {
  user: { org_id: 'vbw' },
}
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

const mountOpts = { global: { plugins: [PrimeVue] } }

function findButtonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find((b) => b.text().includes(text))
  if (!button) throw new Error(`No button with text "${text}" found`)
  return button
}

describe('MyStammdatenView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user = { org_id: 'vbw' }
    mockGetMySelfServiceData.mockResolvedValue({ data: buildSelfServiceDetail() })
    mockGetMyChangeRequest.mockRejectedValue({ response: { status: 404 } })
  })

  it('pre-fills the form from live data when no request is pending', async () => {
    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()

    expect(mockGetMySelfServiceData).toHaveBeenCalledOnce()
    const inputs = wrapper.findAll('input[type="text"]')
    expect(inputs.some((i) => (i.element as HTMLInputElement).value === 'Max')).toBe(true)
    expect(wrapper.findComponent({ name: 'Message' }).exists()).toBe(false)
  })

  it('overlays proposed values and shows the pending banner when a request exists', async () => {
    const pending: MyChangeRequest = {
      id: '55555555-5555-5555-5555-555555555555',
      created_at: '2026-08-06T10:00:00Z',
      proposed_fields: { nachname: 'Geaendert' },
    }
    mockGetMyChangeRequest.mockReset()
    mockGetMyChangeRequest.mockResolvedValue({ data: pending })

    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'Message' }).exists()).toBe(true)
    const inputs = wrapper.findAll('input[type="text"]')
    expect(inputs.some((i) => (i.element as HTMLInputElement).value === 'Geaendert')).toBe(true)
    // vorname was NOT proposed - must keep the live value, not be wiped
    expect(inputs.some((i) => (i.element as HTMLInputElement).value === 'Max')).toBe(true)
  })

  it('shows the MKV/OGV field only for vbw members', async () => {
    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('MKV/OGV-Link')
  })

  it('hides the MKV/OGV field for vbn members', async () => {
    mockAuthStore.user = { org_id: 'vbn' }
    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).not.toContain('MKV/OGV-Link')
  })

  it('submits changes and shows the pending banner on success', async () => {
    mockSubmitMyChangeRequest.mockResolvedValue({ data: { status: 'submitted' } })
    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()

    await findButtonByText(wrapper, 'Antrag einreichen').trigger('click')
    await flushPromises()

    expect(mockSubmitMyChangeRequest).toHaveBeenCalledOnce()
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
    expect(wrapper.findComponent({ name: 'Message' }).exists()).toBe(true)
  })

  it('sends a cleared text field as null, not an empty string', async () => {
    mockGetMySelfServiceData.mockResolvedValue({
      data: buildSelfServiceDetail({ arbeitgeber: 'Firma GmbH' }),
    })
    mockSubmitMyChangeRequest.mockResolvedValue({ data: { status: 'submitted' } })
    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()

    const inputs = wrapper.findAll('input[type="text"]')
    const arbeitgeberInput = inputs.find(
      (i) => (i.element as HTMLInputElement).value === 'Firma GmbH',
    )!
    await arbeitgeberInput.setValue('')
    await findButtonByText(wrapper, 'Antrag einreichen').trigger('click')
    await flushPromises()

    const payload = mockSubmitMyChangeRequest.mock.calls[0]![0]
    expect(payload['arbeitgeber']).toBeNull()
  })

  it('shows an info toast when submitting produces no changes', async () => {
    mockSubmitMyChangeRequest.mockResolvedValue({ data: { status: 'no_changes' } })
    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()

    await findButtonByText(wrapper, 'Antrag einreichen').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info' }))
  })

  it('shows a retry state instead of a blank submittable form when live data fails to load', async () => {
    mockGetMySelfServiceData.mockReset()
    mockGetMySelfServiceData.mockRejectedValue(new Error('boom'))

    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Stammdaten konnten nicht geladen werden.')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text().includes('Antrag einreichen'))).toBe(
      false,
    )
    expect(wrapper.findAll('button').some((b) => b.text().includes('Erneut versuchen'))).toBe(true)
    expect(mockSubmitMyChangeRequest).not.toHaveBeenCalled()
  })

  it('shows the same retry state when the pending request cannot be read', async () => {
    mockGetMyChangeRequest.mockReset()
    mockGetMyChangeRequest.mockRejectedValue({ response: { status: 500 } })

    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Stammdaten konnten nicht geladen werden.')
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('loads the form once the retry succeeds', async () => {
    mockGetMySelfServiceData.mockReset()
    mockGetMySelfServiceData
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ data: buildSelfServiceDetail() })

    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()
    await findButtonByText(wrapper, 'Erneut versuchen').trigger('click')
    await flushPromises()

    expect(mockGetMySelfServiceData).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('konnten nicht geladen werden')
    const inputs = wrapper.findAll('input[type="text"]')
    expect(inputs.some((i) => (i.element as HTMLInputElement).value === 'Max')).toBe(true)
  })

  it('shows field-level validation errors from a 422 response', async () => {
    mockSubmitMyChangeRequest.mockRejectedValue({
      response: {
        status: 422,
        data: { detail: [{ loc: ['body', 'nachname'], msg: 'Maximal 64 Zeichen.' }] },
      },
    })
    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()

    await findButtonByText(wrapper, 'Antrag einreichen').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Maximal 64 Zeichen.')
  })

  it('names every field of the form in German in the validation summary', async () => {
    const labels: Record<string, string> = {
      vortitel: 'Vortitel',
      vorname: 'Vorname',
      nachname: 'Nachname',
      nachname_geburt: 'Geburtsname',
      nachtitel: 'Nachtitel',
      couleurname: 'Couleurname',
      email: 'E-Mail',
      url: 'URI',
      mkv_ogv_url: 'MKV/OGV-Link',
      rufnummer_mobil: 'Rufnummer (mobil)',
      rufnummer_privat: 'Rufnummer (privat)',
      rufnummer_beruf: 'Rufnummer (beruflich)',
      zustellungen: 'Zustellung',
      adresse_privat_anschrift: 'Privatadresse (Anschrift)',
      adresse_privat_plz: 'Privatadresse (PLZ)',
      adresse_privat_ort: 'Privatadresse (Ort)',
      adresse_privat_land: 'Privatadresse (Land)',
      adresse_beruf_anschrift: 'Berufsadresse (Anschrift)',
      adresse_beruf_plz: 'Berufsadresse (PLZ)',
      adresse_beruf_ort: 'Berufsadresse (Ort)',
      adresse_beruf_land: 'Berufsadresse (Land)',
      arbeitgeber: 'Arbeitgeber',
      taetigkeit: 'Tätigkeit',
      mitgliedschaften: 'Weitere Mitgliedschaften',
      verbandchargen: 'Verbandschargen',
    }
    mockSubmitMyChangeRequest.mockRejectedValue({
      response: {
        status: 422,
        data: {
          detail: Object.keys(labels).map((field) => ({
            loc: ['body', field],
            msg: `ungültig (${field})`,
          })),
        },
      },
    })
    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()

    await findButtonByText(wrapper, 'Antrag einreichen').trigger('click')
    await flushPromises()

    const lines = wrapper.findAll('li').map((li) => li.text())
    Object.entries(labels).forEach(([field, label]) => {
      expect(lines).toContain(`${label}: ungültig (${field})`)
    })
  })

  describe('submitted payload', () => {
    // Control id -> payload key, for every free-text control of the form.
    const TEXT_CONTROLS: Record<string, string> = {
      'stammdaten-vortitel': 'vortitel',
      'stammdaten-vorname': 'vorname',
      'stammdaten-nachname': 'nachname',
      'stammdaten-nachtitel': 'nachtitel',
      'stammdaten-couleurname': 'couleurname',
      'stammdaten-nachname-geburt': 'nachname_geburt',
      'stammdaten-adresse-privat-anschrift': 'adresse_privat_anschrift',
      'stammdaten-adresse-privat-plz': 'adresse_privat_plz',
      'stammdaten-adresse-privat-ort': 'adresse_privat_ort',
      'stammdaten-adresse-privat-land': 'adresse_privat_land',
      'stammdaten-adresse-beruf-anschrift': 'adresse_beruf_anschrift',
      'stammdaten-adresse-beruf-plz': 'adresse_beruf_plz',
      'stammdaten-adresse-beruf-ort': 'adresse_beruf_ort',
      'stammdaten-adresse-beruf-land': 'adresse_beruf_land',
      'stammdaten-email': 'email',
      'stammdaten-url': 'url',
      'stammdaten-mkv-ogv-url': 'mkv_ogv_url',
      'stammdaten-rufnummer-mobil': 'rufnummer_mobil',
      'stammdaten-rufnummer-privat': 'rufnummer_privat',
      'stammdaten-rufnummer-beruf': 'rufnummer_beruf',
      'stammdaten-arbeitgeber': 'arbeitgeber',
      'stammdaten-taetigkeit': 'taetigkeit',
      'stammdaten-mitgliedschaften': 'mitgliedschaften',
      'stammdaten-verbandchargen': 'verbandchargen',
    }

    async function submitAndGetPayload(wrapper: ReturnType<typeof mount>) {
      await findButtonByText(wrapper, 'Antrag einreichen').trigger('click')
      await flushPromises()
      return mockSubmitMyChangeRequest.mock.calls[0]![0] as Record<string, string | null>
    }

    beforeEach(() => {
      mockSubmitMyChangeRequest.mockResolvedValue({ data: { status: 'submitted' } })
    })

    it('carries every edited control into its own payload field', async () => {
      const wrapper = mount(MyStammdatenView, mountOpts)
      await flushPromises()

      for (const [controlId, field] of Object.entries(TEXT_CONTROLS)) {
        await wrapper.find(`#${controlId}`).setValue(`neu ${field}`)
      }
      const payload = await submitAndGetPayload(wrapper)

      for (const field of Object.values(TEXT_CONTROLS)) {
        expect(payload[field], field).toBe(`neu ${field}`)
      }
    })

    it('sends the chosen delivery address', async () => {
      const wrapper = mount(MyStammdatenView, mountOpts)
      await flushPromises()

      wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', 'adresse_beruf')
      await flushPromises()
      const payload = await submitAndGetPayload(wrapper)

      expect(payload['zustellungen']).toBe('adresse_beruf')
    })

    it('drops surrounding blanks and turns a blank value into null', async () => {
      const wrapper = mount(MyStammdatenView, mountOpts)
      await flushPromises()

      await wrapper.find('#stammdaten-vorname').setValue('  Moritz  ')
      await wrapper.find('#stammdaten-arbeitgeber').setValue('   ')
      const payload = await submitAndGetPayload(wrapper)

      expect(payload['vorname']).toBe('Moritz')
      expect(payload['arbeitgeber']).toBeNull()
    })

    it('keeps an unedited live value in the payload', async () => {
      const wrapper = mount(MyStammdatenView, mountOpts)
      await flushPromises()

      const payload = await submitAndGetPayload(wrapper)

      expect(payload['nachname']).toBe('Mustermann')
      expect(payload['email']).toBe('max@verein.at')
      expect(payload['zustellungen']).toBe('deaktiviert')
    })
  })

  describe('pending request banner', () => {
    it('names the day the pending request was submitted', async () => {
      mockGetMyChangeRequest.mockReset()
      mockGetMyChangeRequest.mockResolvedValue({
        data: {
          id: '55555555-5555-5555-5555-555555555555',
          created_at: '2026-08-06T10:00:00Z',
          proposed_fields: {},
        },
      })

      const wrapper = mount(MyStammdatenView, mountOpts)
      await flushPromises()

      expect(wrapper.text()).toContain('Antrag eingereicht am')
      expect(wrapper.text()).toContain('06. August 2026')
    })

    it('removes the banner when a resubmission turns out to change nothing', async () => {
      mockGetMyChangeRequest.mockReset()
      mockGetMyChangeRequest.mockResolvedValue({
        data: {
          id: '55555555-5555-5555-5555-555555555555',
          created_at: '2026-08-06T10:00:00Z',
          proposed_fields: {},
        },
      })
      mockSubmitMyChangeRequest.mockResolvedValue({ data: { status: 'no_changes' } })

      const wrapper = mount(MyStammdatenView, mountOpts)
      await flushPromises()
      expect(wrapper.text()).toContain('wartet auf Freigabe')

      await findButtonByText(wrapper, 'Antrag einreichen').trigger('click')
      await flushPromises()

      expect(wrapper.text()).not.toContain('wartet auf Freigabe')
    })
  })

  describe('failed submission', () => {
    async function submitWithError(error: unknown) {
      mockSubmitMyChangeRequest.mockRejectedValue(error)
      const wrapper = mount(MyStammdatenView, mountOpts)
      await flushPromises()
      await findButtonByText(wrapper, 'Antrag einreichen').trigger('click')
      await flushPromises()
      return wrapper
    }

    it('shows a plain error detail from the API in a toast', async () => {
      await submitWithError({
        response: { status: 409, data: { detail: 'Es liegt bereits ein Antrag vor.' } },
      })

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Es liegt bereits ein Antrag vor.',
        }),
      )
    })

    it('falls back to a generic error toast when the API gives no detail', async () => {
      await submitWithError(new Error('network down'))

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'Fehler' }),
      )
    })

    it('uses the raw field name for an error on a field without a German label', async () => {
      const wrapper = await submitWithError({
        response: {
          status: 422,
          data: { detail: [{ loc: ['body', 'unbekannt'], msg: 'nicht erlaubt' }] },
        },
      })

      expect(wrapper.findAll('li').map((li) => li.text())).toEqual(['unbekannt: nicht erlaubt'])
    })

    it('ignores validation entries that name no field', async () => {
      const wrapper = await submitWithError({
        response: {
          status: 422,
          data: { detail: [{ msg: 'ohne Ort' }, 'Text statt Objekt', null] },
        },
      })

      expect(wrapper.findAll('li')).toHaveLength(0)
      expect(wrapper.text()).not.toContain('Validierungsfehler')
    })

    it('clears the errors of a previous attempt on the next submit', async () => {
      mockSubmitMyChangeRequest.mockRejectedValueOnce({
        response: {
          status: 422,
          data: { detail: [{ loc: ['body', 'email'], msg: 'Ungültige Adresse.' }] },
        },
      })
      mockSubmitMyChangeRequest.mockResolvedValueOnce({ data: { status: 'submitted' } })
      const wrapper = mount(MyStammdatenView, mountOpts)
      await flushPromises()

      await findButtonByText(wrapper, 'Antrag einreichen').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('Ungültige Adresse.')

      await findButtonByText(wrapper, 'Antrag einreichen').trigger('click')
      await flushPromises()

      expect(wrapper.text()).not.toContain('Ungültige Adresse.')
    })
  })

  it('connects every label of a text field to a control', async () => {
    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()

    const labels = wrapper.findAll('label[for]')
    expect(labels).toHaveLength(25)
    labels.forEach((label) => {
      expect(
        wrapper.find(`#${label.attributes('for')}`).exists(),
        `no control for label "${label.text()}"`,
      ).toBe(true)
    })
  })
})
