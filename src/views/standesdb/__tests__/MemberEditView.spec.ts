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
    id: '11111111-1111-1111-1111-111111111111',
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
    parent_id: null,
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
    mockCreateMember.mockResolvedValue({ data: { id: '99999999-9999-9999-9999-999999999999' } })
    mockUpdateMember.mockResolvedValue({})
  })

  it('shows the create heading and defaults org_id to the current user org for a new member', async () => {
    const wrapper = await mountAt('/standesdb/members/new')
    await flushPromises()

    expect(wrapper.text()).toContain('Neues Mitglied anlegen')
    expect(mockGetMember).not.toHaveBeenCalled()
  })

  it('loads and pre-fills an existing member for editing', async () => {
    const wrapper = await mountAt('/standesdb/members/11111111-1111-1111-1111-111111111111/edit')
    await flushPromises()

    expect(mockGetMember).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111')
    expect(wrapper.text()).toContain('Mitglied bearbeiten')
    const inputs = wrapper.findAll('input[type="text"]')
    expect(inputs.some((i) => (i.element as HTMLInputElement).value === 'Max')).toBe(true)
  })

  it('redirects to not-found on a 404', async () => {
    mockGetMember.mockRejectedValueOnce({ response: { status: 404 } })
    await mountAt('/standesdb/members/00000000-0000-0000-0000-000000000000/edit')
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

  it('fills the chronicle and lock checkboxes from the loaded member', async () => {
    mockGetMember.mockResolvedValue({
      data: buildMember({ chroniclemail: true, auth_locked: false }),
    })
    const wrapper = await mountAt('/standesdb/members/11111111-1111-1111-1111-111111111111/edit')
    await flushPromises()

    // Checkbox order: Gründer, Entlassen, Verstorben, Chroniclemails, Zugang gesperrt.
    const checkboxes = wrapper.findAllComponents({ name: 'Checkbox' })
    expect(checkboxes[3]!.props('modelValue')).toBe(true)
    expect(checkboxes[4]!.props('modelValue')).toBe(false)
  })

  it('keeps the safe defaults when the API withholds the account status', async () => {
    mockGetMember.mockResolvedValue({
      data: buildMember({ chroniclemail: null, auth_locked: null }),
    })
    const wrapper = await mountAt('/standesdb/members/11111111-1111-1111-1111-111111111111/edit')
    await flushPromises()

    const checkboxes = wrapper.findAllComponents({ name: 'Checkbox' })
    expect(checkboxes[3]!.props('modelValue')).toBe(false)
    expect(checkboxes[4]!.props('modelValue')).toBe(true)
  })

  it('shows the MKV/OGV link field only for org vbw', async () => {
    mockGetMember.mockResolvedValue({ data: buildMember({ org_id: 'vbn' }) })
    const wrapper = await mountAt('/standesdb/members/11111111-1111-1111-1111-111111111111/edit')
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
    expect(router.currentRoute.value.params['id']).toBe('99999999-9999-9999-9999-999999999999')
  })

  it('sends a cleared text field as null, not an empty string', async () => {
    mockGetMember.mockResolvedValue({ data: buildMember({ email: 'max@verein.at' }) })
    const wrapper = await mountAt('/standesdb/members/11111111-1111-1111-1111-111111111111/edit')
    await flushPromises()

    const emailInput = wrapper.find('input[type="email"]')
    await emailInput.setValue('')
    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    const payload = mockUpdateMember.mock.calls[0]![1]
    expect(payload.email).toBeNull()
  })

  describe('text fields and labels', () => {
    const MEMBER_PATH = '/standesdb/members/11111111-1111-1111-1111-111111111111/edit'
    const TEXT_FIELDS = [
      'vortitel',
      'vorname',
      'nachname',
      'nachname_geburt',
      'nachtitel',
      'couleurname',
      'grabadresse',
      'email',
      'url',
      'mkv_ogv_url',
      'rufnummer_mobil',
      'rufnummer_privat',
      'rufnummer_beruf',
      'adresse_privat_anschrift',
      'adresse_privat_plz',
      'adresse_privat_ort',
      'adresse_privat_land',
      'adresse_beruf_anschrift',
      'adresse_beruf_plz',
      'adresse_beruf_ort',
      'adresse_beruf_land',
      'arbeitgeber',
      'taetigkeit',
      'mitgliedschaften',
      'verbandchargen',
      'anmerkungen',
    ] as const

    const filledMember = () =>
      buildMember({
        verstorben: true,
        ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, 'Wert'])),
      })

    it.each(TEXT_FIELDS)('sends a blank %s as null', async (field) => {
      mockGetMember.mockResolvedValue({ data: filledMember() })
      const wrapper = await mountAt(MEMBER_PATH)
      await flushPromises()

      await wrapper.find(`#member-${field.replaceAll('_', '-')}`).setValue('   ')
      await wrapper
        .findAll('button')
        .find((b) => b.text() === 'Speichern')!
        .trigger('click')
      await flushPromises()

      const payload = mockUpdateMember.mock.calls[0]![1]
      TEXT_FIELDS.forEach((other) => {
        expect(payload[other]).toBe(other === field ? null : 'Wert')
      })
    })

    it('connects every label of a text field to a control', async () => {
      mockGetMember.mockResolvedValue({ data: filledMember() })
      const wrapper = await mountAt(MEMBER_PATH)
      await flushPromises()

      const labels = wrapper.findAll('label[for]')
      expect(labels).toHaveLength(29)
      labels.forEach((label) => {
        expect(
          wrapper.find(`#${label.attributes('for')}`).exists(),
          `no control for label "${label.text()}"`,
        ).toBe(true)
      })
    })

    it('drops the general messages of an earlier attempt when saving again', async () => {
      mockUpdateMember
        .mockRejectedValueOnce({ response: { data: { detail: ['Allgemeiner Konflikt.'] } } })
        .mockRejectedValueOnce({ response: { data: { detail: 'Name bereits vergeben.' } } })
      const wrapper = await mountAt(MEMBER_PATH)
      await flushPromises()
      const save = () =>
        wrapper
          .findAll('button')
          .find((b) => b.text() === 'Speichern')!
          .trigger('click')

      await save()
      await flushPromises()
      expect(wrapper.text()).toContain('Allgemeiner Konflikt.')
      await save()
      await flushPromises()

      expect(wrapper.text()).not.toContain('Allgemeiner Konflikt.')
    })
  })

  it('updates an existing member and navigates back to its detail page', async () => {
    const wrapper = await mountAt('/standesdb/members/11111111-1111-1111-1111-111111111111/edit')
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(mockUpdateMember).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      expect.objectContaining({ vorname: 'Max' }),
    )
    expect(router.currentRoute.value.name).toBe('standesdb-member-show')
    expect(router.currentRoute.value.params['id']).toBe('11111111-1111-1111-1111-111111111111')
  })

  it('shows a plain error toast for a string error detail', async () => {
    mockUpdateMember.mockRejectedValueOnce({ response: { data: { detail: 'Konflikt.' } } })
    const wrapper = await mountAt('/standesdb/members/11111111-1111-1111-1111-111111111111/edit')
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
    const wrapper = await mountAt('/standesdb/members/11111111-1111-1111-1111-111111111111/edit')
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Validierungsfehler')
    expect(wrapper.text()).toContain('nachname:')
    expect(wrapper.text()).toContain('field required')
  })

  it('shows plain string entries from an array error detail', async () => {
    mockUpdateMember.mockRejectedValueOnce({
      response: { data: { detail: ['Rollenverlauf überschneidet sich.'] } },
    })
    const wrapper = await mountAt('/standesdb/members/11111111-1111-1111-1111-111111111111/edit')
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'Validierungsfehler',
        detail: 'Rollenverlauf überschneidet sich.',
      }),
    )
  })

  it('shows both plain string and field validation errors from a mixed array detail', async () => {
    mockUpdateMember.mockRejectedValueOnce({
      response: {
        data: {
          detail: ['Allgemeiner Konflikt.', { loc: ['body', 'email'], msg: 'invalid format' }],
        },
      },
    })
    const wrapper = await mountAt('/standesdb/members/11111111-1111-1111-1111-111111111111/edit')
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Allgemeiner Konflikt.')
    expect(wrapper.text()).toContain('email:')
    expect(wrapper.text()).toContain('invalid format')
  })

  it('falls back to a generic error toast when the API sends no detail', async () => {
    mockUpdateMember.mockRejectedValueOnce(new Error('network failure'))
    const wrapper = await mountAt('/standesdb/members/11111111-1111-1111-1111-111111111111/edit')
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Fehler' }),
    )
  })

  describe('editing through the child controls', () => {
    const MEMBER_PATH = '/standesdb/members/11111111-1111-1111-1111-111111111111/edit'

    async function mountMember(member: MemberDetail = buildMember(), path = MEMBER_PATH) {
      mockGetMember.mockResolvedValue({ data: member })
      const wrapper = await mountAt(path)
      await flushPromises()
      return wrapper
    }

    async function saveAndGetPayload(wrapper: Awaited<ReturnType<typeof mountAt>>) {
      await wrapper
        .findAll('button')
        .find((b) => b.text() === 'Speichern')!
        .trigger('click')
      await flushPromises()
      const call = mockUpdateMember.mock.calls[0] ?? mockCreateMember.mock.calls[0]
      return (call!.at(-1) ?? {}) as Record<string, unknown>
    }

    const pickerByLabel = (wrapper: Awaited<ReturnType<typeof mountAt>>, label: string) =>
      wrapper
        .findAllComponents({ name: 'FuzzyDatePicker' })
        .find((p) => p.props('label') === label)!

    const selectByInputId = (wrapper: Awaited<ReturnType<typeof mountAt>>, inputId: string) =>
      wrapper.findAllComponents({ name: 'Select' }).find((s) => s.props('inputId') === inputId)!

    it.each([
      ['Geburtsdatum', 'geburtsdatum'],
      ['Aufnahmedatum', 'aufnahmedatum'],
      ['Branderdatum', 'branderdatum'],
      ['Burschungsdatum', 'burschungsdatum'],
      ['Philistrierungsdatum', 'philistrierungsdatum'],
    ])('stores the date and accuracy of the %s under their own keys', async (label, key) => {
      const wrapper = await mountMember()

      const picker = pickerByLabel(wrapper, label)
      picker.vm.$emit('update:date', '1999-05-17')
      picker.vm.$emit('update:accuracy', 2)
      const payload = await saveAndGetPayload(wrapper)

      expect(payload[key]).toBe('1999-05-17')
      expect(payload[`${key}_accuracy`]).toBe(2)
      // No other date field is touched.
      const others = ['geburtsdatum', 'aufnahmedatum', 'branderdatum', 'burschungsdatum']
      others.filter((other) => other !== key).forEach((other) => expect(payload[other]).toBeNull())
    })

    it('stores the dismissal and death dates of the pickers that appear for them', async () => {
      const wrapper = await mountMember(buildMember({ entlassen: true, verstorben: true }))

      const entlassung = pickerByLabel(wrapper, 'Entlassungsdatum')
      entlassung.vm.$emit('update:date', '2010-03-01')
      entlassung.vm.$emit('update:accuracy', 1)
      const sterbe = pickerByLabel(wrapper, 'Sterbedatum')
      sterbe.vm.$emit('update:date', '2020-12-24')
      sterbe.vm.$emit('update:accuracy', 3)
      const payload = await saveAndGetPayload(wrapper)

      expect(payload['entlassungsdatum']).toBe('2010-03-01')
      expect(payload['entlassungsdatum_accuracy']).toBe(1)
      expect(payload['sterbedatum']).toBe('2020-12-24')
      expect(payload['sterbedatum_accuracy']).toBe(3)
    })

    it('stores the chosen Leibbursch and leaves the display name out of the payload', async () => {
      const wrapper = await mountMember()

      const selector = wrapper.findComponent({ name: 'ParentSelector' })
      expect(selector.props('memberId')).toBe('11111111-1111-1111-1111-111111111111')
      selector.vm.$emit('update:parentId', '22222222-2222-2222-2222-222222222222')
      selector.vm.$emit('update:parentCn', 'Leib Bursch')
      await flushPromises()
      expect(selector.props('parentCn')).toBe('Leib Bursch')
      const payload = await saveAndGetPayload(wrapper)

      expect(payload['parent_id']).toBe('22222222-2222-2222-2222-222222222222')
      expect(payload).not.toHaveProperty('parent_cn')
    })

    it('stores edited badges, keys and role history', async () => {
      const wrapper = await mountMember()
      const badge = { id: 'b1', presentationdate: '2001-01-01', presentationdate_accuracy: 0 }
      const key = { id: 'k1', presentationdate: null, presentationdate_accuracy: 0 }
      const role = { id: 'r1', startdate: '2015-01-01', enddate: null }

      const [badges, keys] = wrapper.findAllComponents({ name: 'SetEditor' })
      expect(badges!.props('title')).toBe('Ehrungen')
      expect(keys!.props('title')).toBe('Schlüssel')
      badges!.vm.$emit('update:modelValue', [badge])
      keys!.vm.$emit('update:modelValue', [key])
      wrapper.findComponent({ name: 'RolesHistoryEditor' }).vm.$emit('update:modelValue', [role])
      const payload = await saveAndGetPayload(wrapper)

      expect(payload['badges']).toEqual([badge])
      expect(payload['keys']).toEqual([key])
      expect(payload['roles_history']).toEqual([role])
    })

    it('stores the flags set through the checkboxes', async () => {
      const wrapper = await mountMember()

      // Checkbox order: Gründer, Entlassen, Verstorben, Chroniclemails, Zugang gesperrt.
      const checkboxes = wrapper.findAllComponents({ name: 'Checkbox' })
      checkboxes[0]!.vm.$emit('update:modelValue', true)
      checkboxes[3]!.vm.$emit('update:modelValue', true)
      checkboxes[4]!.vm.$emit('update:modelValue', true)
      const payload = await saveAndGetPayload(wrapper)

      expect(payload['gruender']).toBe(true)
      expect(payload['chroniclemail']).toBe(true)
      expect(payload['auth_locked']).toBe(true)
      expect(payload['entlassen']).toBe(false)
      expect(payload['verstorben']).toBe(false)
    })

    it('stores the state and the delivery address chosen in the selects', async () => {
      const wrapper = await mountMember()

      selectByInputId(wrapper, 'member-state-id').vm.$emit('update:modelValue', null)
      selectByInputId(wrapper, 'member-zustellungen').vm.$emit(
        'update:modelValue',
        'adresse_privat',
      )
      const payload = await saveAndGetPayload(wrapper)

      expect(payload['state_id']).toBeNull()
      expect(payload['zustellungen']).toBe('adresse_privat')
    })

    it('lets a new member pick the organisation and hides the MKV/OGV field for other ones', async () => {
      mockAuthStore.user = {
        org_id: 'vbw',
        permissions: ['standesdbVbwAdmin', 'standesdbVbnAdmin'],
      }
      const wrapper = await mountMember(buildMember(), '/standesdb/members/new')
      expect(wrapper.text()).toContain('MKV/OGV-Link')

      const org = selectByInputId(wrapper, 'member-org-id')
      expect(org.props('disabled')).toBe(false)
      org.vm.$emit('update:modelValue', 'vbn')
      await flushPromises()
      expect(wrapper.text()).not.toContain('MKV/OGV-Link')
      const payload = await saveAndGetPayload(wrapper)

      expect(payload['org_id']).toBe('vbn')
    })

    it('does not let an existing member change the organisation', async () => {
      const wrapper = await mountMember()

      expect(selectByInputId(wrapper, 'member-org-id').props('disabled')).toBe(true)
    })

    it('defaults a new member to the organisation of the current user', async () => {
      mockAuthStore.user = { org_id: 'vbn', permissions: ['standesdbVbnAdmin'] }
      const wrapper = await mountMember(buildMember(), '/standesdb/members/new')

      const payload = await saveAndGetPayload(wrapper)

      expect(payload['org_id']).toBe('vbn')
    })

    it('offers no organisation to a user without any permission and defaults to vbw', async () => {
      mockAuthStore.user = null
      const wrapper = await mountMember(buildMember(), '/standesdb/members/new')

      expect(selectByInputId(wrapper, 'member-org-id').props('options')).toEqual([])
      const payload = await saveAndGetPayload(wrapper)
      expect(payload['org_id']).toBe('vbw')
    })

    it('keeps the form default for a field the API does not send', async () => {
      const { anmerkungen: _anmerkungen, badges: _badges, ...withoutTwo } = buildMember()
      const wrapper = await mountMember(withoutTwo as MemberDetail)

      const payload = await saveAndGetPayload(wrapper)

      expect(payload['anmerkungen']).toBeNull()
      expect(payload['badges']).toEqual([])
      expect(payload['vorname']).toBe('Max')
    })

    it('goes back in the history from both cancel buttons without saving', async () => {
      const wrapper = await mountMember()
      const back = vi.spyOn(router, 'back').mockImplementation(() => undefined)

      const cancelButtons = wrapper.findAll('button').filter((b) => b.text() === 'Abbrechen')
      expect(cancelButtons).toHaveLength(2)
      for (const button of cancelButtons) await button.trigger('click')

      expect(back).toHaveBeenCalledTimes(2)
      expect(mockUpdateMember).not.toHaveBeenCalled()
      back.mockRestore()
    })

    describe('unusable error details', () => {
      async function saveWithError(detail: unknown) {
        mockUpdateMember.mockRejectedValueOnce({ response: { data: { detail } } })
        const wrapper = await mountMember()
        await wrapper
          .findAll('button')
          .find((b) => b.text() === 'Speichern')!
          .trigger('click')
        await flushPromises()
        return wrapper
      }

      it('stays silent for a detail that is neither text nor a list', async () => {
        const wrapper = await saveWithError({ unexpected: true })

        expect(mockToastAdd).not.toHaveBeenCalled()
        expect(wrapper.text()).not.toContain('Validierungsfehler')
      })

      it('shows no toast when no entry of the list names a field or is text', async () => {
        const wrapper = await saveWithError([{ msg: 'ohne Ort' }, null, 42])

        expect(mockToastAdd).not.toHaveBeenCalled()
        expect(wrapper.findAll('li')).toHaveLength(0)
      })

      it('shows a field error whose message is missing as an empty message', async () => {
        const wrapper = await saveWithError([{ loc: ['body', 'url'] }])

        expect(wrapper.findAll('li').map((li) => li.text())).toEqual(['url:'])
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({ summary: 'Validierungsfehler' }),
        )
      })
    })
  })

  it('redirects to not-found on a 403', async () => {
    mockGetMember.mockRejectedValueOnce({ response: { status: 403 } })
    await mountAt('/standesdb/members/00000000-0000-0000-0000-000000000000/edit')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('shows a retry state instead of a blank editable form on an unrelated load error', async () => {
    mockGetMember.mockRejectedValueOnce({ response: { status: 500 } })
    const wrapper = await mountAt('/standesdb/members/11111111-1111-1111-1111-111111111111/edit')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('standesdb-member-edit')
    expect(wrapper.text()).toContain('Das Mitglied konnte nicht geladen werden.')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.findAll('button').find((b) => b.text() === 'Speichern')).toBeUndefined()
    expect(wrapper.findAll('button').some((b) => b.text() === 'Erneut versuchen')).toBe(true)
    expect(mockUpdateMember).not.toHaveBeenCalled()
  })

  it('loads the form once the retry succeeds', async () => {
    mockGetMember.mockRejectedValueOnce({ response: { status: 500 } })
    const wrapper = await mountAt('/standesdb/members/1/edit')
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Erneut versuchen')!
      .trigger('click')
    await flushPromises()

    expect(mockGetMember).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('konnte nicht geladen werden')
    expect(wrapper.text()).toContain('Mitglied bearbeiten')
    expect(mockGetMember).toHaveBeenCalledTimes(2)
  })

  it('shows the same retry state for a failed reference data request and does not save', async () => {
    mockGetReferenceData.mockRejectedValueOnce(new Error('Network Error'))
    const wrapper = await mountAt('/standesdb/members/1/edit')
    await flushPromises()

    expect(wrapper.text()).toContain('Das Mitglied konnte nicht geladen werden.')
    expect(wrapper.find('input').exists()).toBe(false)
  })
})
