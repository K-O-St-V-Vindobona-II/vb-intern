import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ContactEditView from '../ContactEditView.vue'
import PrimeVue from 'primevue/config'
import type { ContactDetail, ReferenceData } from '@/types/standesdb'

// Wrappers left mounted by earlier cases would react to the route changes of later ones.
enableAutoUnmount(afterEach)

function buildReferenceData(): ReferenceData {
  return {
    orgs: [{ id: 'vbw', label: 'Wien', order: 1 }],
    states: [],
    roles: [],
    badges: [],
    keys: [],
  }
}

function buildContact(overrides: Partial<ContactDetail> = {}): ContactDetail {
  return {
    id: '1',
    cn: 'Firma GmbH',
    kontakttyp: 'organisation',
    anrede: null,
    name: 'Firma GmbH',
    couleurname: null,
    org_id: 'vbw',
    org_label: 'Wien',
    adresse_anschrift: 'Teststraße 1',
    adresse_plz: '1010',
    adresse_ort: 'Wien',
    adresse_land: 'Österreich',
    zustellungen: true,
    email: 'kontakt@firma.at',
    rufnummer: '+43123456',
    datum: null,
    datum_accuracy: 0,
    default_image: null,
    anmerkungen: null,
    ...overrides,
  }
}

const mockGetReferenceData = vi.fn()
const mockGetContact = vi.fn()
const mockCreateContact = vi.fn()
const mockUpdateContact = vi.fn()
vi.mock('@/services/standesdbService', () => ({
  default: {
    getReferenceData: (...args: unknown[]) => mockGetReferenceData(...args),
    getContact: (...args: unknown[]) => mockGetContact(...args),
    createContact: (...args: unknown[]) => mockCreateContact(...args),
    updateContact: (...args: unknown[]) => mockUpdateContact(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/standesdb/contacts/new', name: 'standesdb-contact-new', component: ContactEditView },
    {
      path: '/standesdb/contacts/:id/edit',
      name: 'standesdb-contact-edit',
      component: ContactEditView,
    },
    {
      path: '/standesdb/contacts/:id',
      name: 'standesdb-contact-show',
      component: { template: '<div />' },
    },
    { path: '/not-found', name: 'not-found', component: { template: '<div />' } },
  ],
})

const stubs = { FuzzyDatePicker: true }

async function mountAt(path: string) {
  await router.push(path)
  await router.isReady()
  return mount(ContactEditView, { global: { plugins: [PrimeVue, router], stubs } })
}

describe('ContactEditView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetReferenceData.mockReset()
    mockGetContact.mockReset()
    mockGetReferenceData.mockResolvedValue({ data: buildReferenceData() })
    mockGetContact.mockResolvedValue({ data: buildContact() })
    mockCreateContact.mockResolvedValue({ data: { id: 9 } })
    mockUpdateContact.mockResolvedValue({})
  })

  it('shows the create-form heading and a blank name field for a new contact', async () => {
    const wrapper = await mountAt('/standesdb/contacts/new')
    await flushPromises()

    expect(wrapper.text()).toContain('Neuen Kontakt anlegen')
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('')
    expect(mockGetContact).not.toHaveBeenCalled()
  })

  it('loads and pre-fills an existing contact for editing', async () => {
    const wrapper = await mountAt('/standesdb/contacts/1/edit')
    await flushPromises()

    expect(mockGetContact).toHaveBeenCalledWith('1')
    expect(wrapper.text()).toContain('Kontakt bearbeiten')
    const emailInput = wrapper.find('input[type="email"]').element as HTMLInputElement
    expect(emailInput.value).toBe('kontakt@firma.at')
  })

  it('redirects to not-found on a 404 while loading', async () => {
    mockGetContact.mockRejectedValueOnce({ response: { status: 404 } })
    await mountAt('/standesdb/contacts/999/edit')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('creates a new contact and navigates to its detail page', async () => {
    const wrapper = await mountAt('/standesdb/contacts/new')
    await flushPromises()

    // Field order in the left column: Kontakttyp (Select), Anrede, Name, ...
    await wrapper.findAll('.col input')[1]!.setValue('Neue Firma GmbH')
    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(mockCreateContact).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Neue Firma GmbH' }),
    )
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
    expect(router.currentRoute.value.name).toBe('standesdb-contact-show')
    expect(router.currentRoute.value.params.id).toBe('9')
  })

  it('updates an existing contact and navigates back to its detail page', async () => {
    const wrapper = await mountAt('/standesdb/contacts/1/edit')
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(mockUpdateContact).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ name: 'Firma GmbH' }),
    )
    expect(router.currentRoute.value.name).toBe('standesdb-contact-show')
    expect(router.currentRoute.value.params.id).toBe('1')
  })

  it('shows a plain error toast for a string error detail', async () => {
    mockUpdateContact.mockRejectedValueOnce({
      response: { data: { detail: 'Name bereits vergeben.' } },
    })
    const wrapper = await mountAt('/standesdb/contacts/1/edit')
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Name bereits vergeben.' }),
    )
  })

  it('maps FastAPI field validation errors onto the form and shows them', async () => {
    mockUpdateContact.mockRejectedValueOnce({
      response: {
        data: {
          detail: [{ loc: ['body', 'name'], msg: 'field required' }],
        },
      },
    })
    const wrapper = await mountAt('/standesdb/contacts/1/edit')
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Validierungsfehler')
    expect(wrapper.text()).toContain('name:')
    expect(wrapper.text()).toContain('field required')
  })

  describe('when the data cannot be loaded', () => {
    const saveButton = (wrapper: Awaited<ReturnType<typeof mountAt>>) =>
      wrapper.findAll('button').find((b) => b.text() === 'Speichern')

    it('shows no form and no save button when the contact cannot be loaded', async () => {
      mockGetContact.mockRejectedValue({ response: { status: 500 } })
      const wrapper = await mountAt('/standesdb/contacts/1/edit')
      await flushPromises()

      expect(wrapper.text()).toContain('Der Kontakt konnte nicht geladen werden.')
      expect(wrapper.find('input').exists()).toBe(false)
      expect(saveButton(wrapper)).toBeUndefined()
      expect(mockUpdateContact).not.toHaveBeenCalled()
    })

    it('shows no form when only the reference data fails', async () => {
      mockGetReferenceData.mockRejectedValue(new Error('Network Error'))
      const wrapper = await mountAt('/standesdb/contacts/1/edit')
      await flushPromises()

      expect(wrapper.text()).toContain('Der Kontakt konnte nicht geladen werden.')
      expect(saveButton(wrapper)).toBeUndefined()
    })

    it('names its own failure on the create form', async () => {
      mockGetReferenceData.mockRejectedValue({ response: { status: 500 } })
      const wrapper = await mountAt('/standesdb/contacts/new')
      await flushPromises()

      expect(wrapper.text()).toContain('Das Formular konnte nicht geladen werden.')
      expect(saveButton(wrapper)).toBeUndefined()
    })

    it('loads the form when "Erneut versuchen" is pressed', async () => {
      mockGetContact.mockRejectedValueOnce({ response: { status: 500 } })
      const wrapper = await mountAt('/standesdb/contacts/1/edit')
      await flushPromises()

      await wrapper
        .findAll('button')
        .find((b) => b.text() === 'Erneut versuchen')!
        .trigger('click')
      await flushPromises()

      expect(wrapper.text()).not.toContain('konnte nicht geladen werden')
      expect((wrapper.find('input[type="email"]').element as HTMLInputElement).value).toBe(
        'kontakt@firma.at',
      )
    })

    it('redirects to not-found on a 403 while loading', async () => {
      mockGetContact.mockRejectedValueOnce({ response: { status: 403 } })
      await mountAt('/standesdb/contacts/1/edit')
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('not-found')
    })
  })

  describe('when the address changes while the view stays mounted', () => {
    it('loads the other contact and saves onto that one', async () => {
      mockGetContact.mockImplementation((id: string) =>
        Promise.resolve({
          data: buildContact({ id, name: `Kontakt ${id}`, email: `${id}@firma.at` }),
        }),
      )
      const wrapper = await mountAt('/standesdb/contacts/A/edit')
      await flushPromises()

      await router.push('/standesdb/contacts/B/edit')
      await flushPromises()

      expect(mockGetContact).toHaveBeenLastCalledWith('B')
      expect((wrapper.find('input[type="email"]').element as HTMLInputElement).value).toBe(
        'B@firma.at',
      )

      await wrapper
        .findAll('button')
        .find((b) => b.text() === 'Speichern')!
        .trigger('click')
      await flushPromises()

      expect(mockUpdateContact).toHaveBeenCalledWith(
        'B',
        expect.objectContaining({ name: 'Kontakt B' }),
      )
    })

    it('ignores a slow answer for the contact that was left', async () => {
      let answerForA: (value: unknown) => void = () => {}
      mockGetContact.mockImplementation((id: string) =>
        id === 'A'
          ? new Promise((resolve) => {
              answerForA = resolve
            })
          : Promise.resolve({ data: buildContact({ id, email: 'B@firma.at' }) }),
      )
      const wrapper = await mountAt('/standesdb/contacts/A/edit')
      await router.push('/standesdb/contacts/B/edit')
      await flushPromises()

      answerForA({ data: buildContact({ id: 'A', email: 'A@firma.at' }) })
      await flushPromises()

      expect((wrapper.find('input[type="email"]').element as HTMLInputElement).value).toBe(
        'B@firma.at',
      )
    })

    it('ignores a late failure for the contact that was left', async () => {
      let failForA: (reason: unknown) => void = () => {}
      mockGetContact.mockImplementation((id: string) =>
        id === 'A'
          ? new Promise((_resolve, reject) => {
              failForA = reject
            })
          : Promise.resolve({ data: buildContact({ id, email: 'B@firma.at' }) }),
      )
      const wrapper = await mountAt('/standesdb/contacts/A/edit')
      await router.push('/standesdb/contacts/B/edit')
      await flushPromises()

      failForA({ response: { status: 500 } })
      await flushPromises()

      expect(wrapper.text()).not.toContain('konnte nicht geladen werden')
      expect((wrapper.find('input[type="email"]').element as HTMLInputElement).value).toBe(
        'B@firma.at',
      )
    })

    it('starts a blank form when an edit page is followed by the create page', async () => {
      const wrapper = await mountAt('/standesdb/contacts/1/edit')
      await flushPromises()

      await router.push('/standesdb/contacts/new')
      await flushPromises()

      expect(wrapper.text()).toContain('Neuen Kontakt anlegen')
      expect((wrapper.find('input[type="email"]').element as HTMLInputElement).value).toBe('')
      expect(mockGetContact).toHaveBeenCalledTimes(1)
    })
  })
})
