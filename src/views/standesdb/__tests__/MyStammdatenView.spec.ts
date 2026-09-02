import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MyStammdatenView from '../MyStammdatenView.vue'
import PrimeVue from 'primevue/config'
import type { MemberSelfServiceDetail, MyChangeRequest } from '@/types/standesdb'

function buildSelfServiceDetail(
  overrides: Partial<MemberSelfServiceDetail> = {},
): MemberSelfServiceDetail {
  return {
    id: 1,
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

  it('shows an info toast when submitting produces no changes', async () => {
    mockSubmitMyChangeRequest.mockResolvedValue({ data: { status: 'no_changes' } })
    const wrapper = mount(MyStammdatenView, mountOpts)
    await flushPromises()

    await findButtonByText(wrapper, 'Antrag einreichen').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info' }))
  })

  it('shows a generic error toast when live data fails to load', async () => {
    mockGetMySelfServiceData.mockReset()
    mockGetMySelfServiceData.mockRejectedValue(new Error('boom'))

    mount(MyStammdatenView, mountOpts)
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
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
})
