import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import MemberEditView from '../MemberEditView.vue'
import PrimeVue from 'primevue/config'
import type { MemberDetail, ReferenceData } from '@/types/standesdb'

function buildReferenceData(): ReferenceData {
  return {
    orgs: [
      { id: 'vbw', label: 'Wien', order: 1 },
      { id: 'vbn', label: 'Neustadt', order: 2 },
    ],
    states: [{ id: 'active', label: 'Aktiv', order: 1 }],
    roles: [],
    badges: [],
    keys: [],
  }
}

function buildMember(overrides: Partial<MemberDetail> = {}): MemberDetail {
  return {
    id: 1,
    cn: 'Max Mustermann',
    vortitel: null,
    vorname: 'Max',
    nachname: 'Mustermann',
    nachname_geburt: null,
    nachtitel: null,
    couleurname: 'Testikus',
    org_id: 'vbw',
    org_label: 'Wien',
    state_id: 'active',
    state_label: 'Aktiv',
    gruender: false,
    entlassen: false,
    verstorben: false,
    grabadresse: null,
    parent_id: 0,
    parent_cn: '',
    default_image: null,
    chroniclemail: false,
    auth_locked: false,
    email: 'max@verein.at',
    email_verified_at: null,
    url: null,
    mkv_ogv_url: null,
    zustellungen: 'deaktiviert',
    rufnummer_mobil: null,
    rufnummer_privat: null,
    rufnummer_beruf: null,
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
    anmerkungen: null,
    geburtsdatum: null,
    geburtsdatum_accuracy: 0,
    aufnahmedatum: null,
    aufnahmedatum_accuracy: 0,
    branderdatum: null,
    branderdatum_accuracy: 0,
    burschungsdatum: null,
    burschungsdatum_accuracy: 0,
    philistrierungsdatum: null,
    philistrierungsdatum_accuracy: 0,
    entlassungsdatum: null,
    entlassungsdatum_accuracy: 0,
    sterbedatum: null,
    sterbedatum_accuracy: 0,
    roles_history: [],
    badges: [],
    keys: [],
    tree: { children: [], ancestry: [] },
    ...overrides,
  }
}

const mockGetReferenceData = vi.fn()
const mockGetMember = vi.fn()
const mockCreateMember = vi.fn()
const mockUpdateMember = vi.fn()
vi.mock('@/services/standesdbService', () => ({
  default: {
    getReferenceData: (...args: unknown[]) => mockGetReferenceData(...args),
    getMember: (...args: unknown[]) => mockGetMember(...args),
    createMember: (...args: unknown[]) => mockCreateMember(...args),
    updateMember: (...args: unknown[]) => mockUpdateMember(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockAuthStore: { user: { org_id: string; permissions: string[] } | null } = {
  user: { org_id: 'vbw', permissions: ['standesdbVbwAdmin'] },
}
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/standesdb/members/new', name: 'standesdb-member-new', component: MemberEditView },
    {
      path: '/standesdb/members/:id/edit',
      name: 'standesdb-member-edit',
      component: MemberEditView,
    },
    {
      path: '/standesdb/members/:id',
      name: 'standesdb-member-show',
      component: { template: '<div />' },
    },
    { path: '/not-found', name: 'not-found', component: { template: '<div />' } },
  ],
})

const stubs = {
  FuzzyDatePicker: true,
  ParentSelector: true,
  SetEditor: true,
  RolesHistoryEditor: true,
}

async function mountAt(path: string) {
  await router.push(path)
  await router.isReady()
  return mount(MemberEditView, { global: { plugins: [PrimeVue, router], stubs } })
}

describe('MemberEditView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user = { org_id: 'vbw', permissions: ['standesdbVbwAdmin'] }
    mockGetReferenceData.mockResolvedValue({ data: buildReferenceData() })
    mockGetMember.mockResolvedValue({ data: buildMember() })
    mockCreateMember.mockResolvedValue({ data: { id: 9 } })
    mockUpdateMember.mockResolvedValue({})
  })

  it('shows the create heading and defaults org_id to the current user org for a new member', async () => {
    const wrapper = await mountAt('/standesdb/members/new')
    await flushPromises()

    expect(wrapper.text()).toContain('Neues Mitglied anlegen')
    expect(mockGetMember).not.toHaveBeenCalled()
  })

  it('loads and pre-fills an existing member for editing', async () => {
    const wrapper = await mountAt('/standesdb/members/1/edit')
    await flushPromises()

    expect(mockGetMember).toHaveBeenCalledWith(1)
    expect(wrapper.text()).toContain('Mitglied bearbeiten')
    const inputs = wrapper.findAll('input[type="text"]')
    expect(inputs.some((i) => (i.element as HTMLInputElement).value === 'Max')).toBe(true)
  })

  it('redirects to not-found on a 404', async () => {
    mockGetMember.mockRejectedValueOnce({ response: { status: 404 } })
    await mountAt('/standesdb/members/999/edit')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('only offers organizations the current user has admin permission for', async () => {
    mockAuthStore.user = { org_id: 'vbw', permissions: ['standesdbVbwAdmin'] }
    const wrapper = await mountAt('/standesdb/members/new')
    await flushPromises()

    const orgSelect = wrapper.findComponent({ name: 'Select' })
    expect(orgSelect.props('options')).toEqual([{ id: 'vbw', label: 'Wien', order: 1 }])
  })

  it('shows the entlassen date picker only once entlassen is checked', async () => {
    const wrapper = await mountAt('/standesdb/members/new')
    await flushPromises()

    expect(wrapper.findAllComponents({ name: 'FuzzyDatePicker' })).toHaveLength(5)
    // Checkbox order: Gründer, Entlassen, Verstorben, Chroniclemails, Zugang gesperrt.
    const entlassenCheckbox = wrapper.findAllComponents({ name: 'Checkbox' })[1]!
    await entlassenCheckbox.vm.$emit('update:modelValue', true)

    expect(wrapper.findAllComponents({ name: 'FuzzyDatePicker' })).toHaveLength(6)
  })

  it('shows the grabadresse field only once verstorben is checked', async () => {
    const wrapper = await mountAt('/standesdb/members/new')
    await flushPromises()
    expect(wrapper.text()).not.toContain('Grabadresse')

    const verstorbenCheckbox = wrapper.findAllComponents({ name: 'Checkbox' })[2]!
    await verstorbenCheckbox.vm.$emit('update:modelValue', true)

    expect(wrapper.text()).toContain('Grabadresse')
  })

  it('shows the MKV/OGV link field only for org vbw', async () => {
    mockGetMember.mockResolvedValue({ data: buildMember({ org_id: 'vbn' }) })
    const wrapper = await mountAt('/standesdb/members/1/edit')
    await flushPromises()

    expect(wrapper.text()).not.toContain('MKV/OGV-Link')
  })

  it('creates a new member and navigates to its detail page, omitting parent_cn from the payload', async () => {
    const wrapper = await mountAt('/standesdb/members/new')
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(mockCreateMember).toHaveBeenCalledOnce()
    const payload = mockCreateMember.mock.calls[0]![0]
    expect(payload).not.toHaveProperty('parent_cn')
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
    expect(router.currentRoute.value.name).toBe('standesdb-member-show')
    expect(router.currentRoute.value.params.id).toBe('9')
  })

  it('updates an existing member and navigates back to its detail page', async () => {
    const wrapper = await mountAt('/standesdb/members/1/edit')
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(mockUpdateMember).toHaveBeenCalledWith(1, expect.objectContaining({ vorname: 'Max' }))
    expect(router.currentRoute.value.name).toBe('standesdb-member-show')
    expect(router.currentRoute.value.params.id).toBe('1')
  })

  it('shows a plain error toast for a string error detail', async () => {
    mockUpdateMember.mockRejectedValueOnce({ response: { data: { detail: 'Konflikt.' } } })
    const wrapper = await mountAt('/standesdb/members/1/edit')
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Konflikt.' }),
    )
  })

  it('maps FastAPI field validation errors onto the form and shows them', async () => {
    mockUpdateMember.mockRejectedValueOnce({
      response: {
        data: { detail: [{ loc: ['body', 'nachname'], msg: 'field required' }] },
      },
    })
    const wrapper = await mountAt('/standesdb/members/1/edit')
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Validierungsfehler')
    expect(wrapper.text()).toContain('nachname:')
    expect(wrapper.text()).toContain('field required')
  })
})
