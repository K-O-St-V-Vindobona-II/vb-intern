import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ContactEditView from '../ContactEditView.vue'
import PrimeVue from 'primevue/config'
import type { ContactDetail, ReferenceData } from '@/types/standesdb'

const CONTACT_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_CONTACT_ID = '22222222-2222-2222-2222-222222222222'
const CREATED_ID = '99999999-9999-9999-9999-999999999999'

// Wrappers left mounted by earlier cases would react to the route changes of later ones.

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
    id: CONTACT_ID,
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
    mockCreateContact.mockResolvedValue({ data: { id: CREATED_ID } })
    mockUpdateContact.mockResolvedValue({})
  })

  it('shows the create-form heading and a blank name field for a new contact', async () => {
    const wrapper = await mountAt('/standesdb/contacts/new')
    await flushPromises()

    expect(wrapper.text()).toContain('Neuen Kontakt anlegen')
    expect((wrapper.find('#contact-name').element as HTMLInputElement).value).toBe('')
    expect(mockGetContact).not.toHaveBeenCalled()
  })

  it('loads and pre-fills an existing contact for editing', async () => {
    const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
    await flushPromises()

    expect(mockGetContact).toHaveBeenCalledWith(CONTACT_ID)
    expect(wrapper.text()).toContain('Kontakt bearbeiten')
    const emailInput = wrapper.find('input[type="email"]').element as HTMLInputElement
    expect(emailInput.value).toBe('kontakt@firma.at')
  })

  it('redirects to not-found on a 404 while loading', async () => {
    mockGetContact.mockRejectedValueOnce({ response: { status: 404 } })
    await mountAt(`/standesdb/contacts/${OTHER_CONTACT_ID}/edit`)
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('creates a new contact and navigates to its detail page', async () => {
    const wrapper = await mountAt('/standesdb/contacts/new')
    await flushPromises()

    await wrapper.find('#contact-name').setValue('Neue Firma GmbH')
    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(mockCreateContact).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Neue Firma GmbH' }),
    )
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
    expect(router.currentRoute.value.name).toBe('standesdb-contact-show')
    expect(router.currentRoute.value.params['id']).toBe(CREATED_ID)
  })

  it('updates an existing contact and navigates back to its detail page', async () => {
    const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(mockUpdateContact).toHaveBeenCalledWith(
      CONTACT_ID,
      expect.objectContaining({ name: 'Firma GmbH' }),
    )
    expect(router.currentRoute.value.name).toBe('standesdb-contact-show')
    expect(router.currentRoute.value.params['id']).toBe(CONTACT_ID)
  })

  it('shows a plain error toast for a string error detail', async () => {
    mockUpdateContact.mockRejectedValueOnce({
      response: { data: { detail: 'Name bereits vergeben.' } },
    })
    const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
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
    const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Speichern')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Validierungsfehler')
    expect(wrapper.text()).toContain('Name: field required')
    expect(wrapper.text()).not.toContain('name:')
  })

  it('sends a cleared optional field as null and a padded name trimmed', async () => {
    const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
    await flushPromises()

    await wrapper.find('#contact-email').setValue('')
    await wrapper.find('#contact-anrede').setValue('   ')
    await wrapper.find('#contact-name').setValue('  Firma AG  ')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Speichern')!
      .trigger('click')
    await flushPromises()

    const payload = mockUpdateContact.mock.calls[0]![1]
    expect(payload).toMatchObject({ email: null, anrede: null, name: 'Firma AG' })
    expect(payload.rufnummer).toBe('+43123456')
  })

  it('limits the input to the lengths the API accepts', async () => {
    const wrapper = await mountAt('/standesdb/contacts/new')
    await flushPromises()

    const limits = {
      '#contact-name': '64',
      '#contact-couleurname': '64',
      '#contact-anrede': '32',
      '#contact-adresse-plz': '8',
      '#contact-adresse-ort': '32',
      '#contact-adresse-land': '32',
      '#contact-email': '128',
    }
    Object.entries(limits).forEach(([selector, max]) => {
      expect(wrapper.find(selector).attributes('maxlength')).toBe(max)
    })
  })

  it('connects every text label to its field', async () => {
    const wrapper = await mountAt('/standesdb/contacts/new')
    await flushPromises()

    const labels = wrapper.findAll('label[for]')
    expect(labels.length).toBeGreaterThanOrEqual(12)
    labels.forEach((label) => {
      const target = wrapper.find(`#${label.attributes('for')}`)
      expect(target.exists(), `no control for label "${label.text()}"`).toBe(true)
    })
  })

  it('shows the message of a rejected e-mail address next to the field', async () => {
    mockUpdateContact.mockRejectedValueOnce({
      response: {
        data: {
          detail: [
            { loc: ['body', 'email'], msg: 'Value error, Keine gültige Adresse.' },
            { loc: ['body', 'rufnummer'], msg: 'Ungültiges Telefonnummernformat.' },
          ],
        },
      },
    })
    const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Speichern')!
      .trigger('click')
    await flushPromises()

    const field = wrapper.find('#contact-email').element.closest('.field')!
    expect(field.textContent).toContain('Keine gültige Adresse.')
    expect(field.textContent).not.toContain('Value error')
    expect(wrapper.text()).toContain('E-Mail: Keine gültige Adresse.')
    expect(wrapper.text()).toContain('Rufnummer: Ungültiges Telefonnummernformat.')
  })

  it('does not show internal keys for plain-text validation errors', async () => {
    mockUpdateContact.mockRejectedValueOnce({
      response: {
        data: { detail: [{ loc: ['body', 'name'], msg: 'zu lang' }, 'Allgemeiner Fehler'] },
      },
    })
    const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Speichern')!
      .trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Allgemeiner Fehler')
    expect(wrapper.text()).not.toContain('validation_')
  })

  it('names the failure when the error carries no reason', async () => {
    mockUpdateContact.mockRejectedValueOnce(new Error('offline'))
    const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Speichern')!
      .trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Speichern fehlgeschlagen.' }),
    )
  })

  describe('the payload', () => {
    const saveButton = (wrapper: Awaited<ReturnType<typeof mountAt>>) =>
      wrapper.findAll('button').find((b) => b.text() === 'Speichern')!

    it('sends the fields that are not trimmed as they were loaded', async () => {
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
      await flushPromises()

      await saveButton(wrapper).trigger('click')
      await flushPromises()

      expect(mockUpdateContact.mock.calls[0]![1]).toMatchObject({
        kontakttyp: 'organisation',
        org_id: 'vbw',
        zustellungen: true,
        datum: null,
        datum_accuracy: 0,
      })
    })

    it.each([
      ['#contact-couleurname', 'couleurname'],
      ['#contact-adresse-anschrift', 'adresse_anschrift'],
      ['#contact-adresse-plz', 'adresse_plz'],
      ['#contact-adresse-ort', 'adresse_ort'],
      ['#contact-adresse-land', 'adresse_land'],
      ['#contact-rufnummer', 'rufnummer'],
      ['#contact-anmerkungen', 'anmerkungen'],
    ])(
      'sends %s as null when blank and without surrounding blanks otherwise',
      async (selector, key) => {
        const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
        await flushPromises()

        await wrapper.find(selector).setValue('   ')
        await saveButton(wrapper).trigger('click')
        await flushPromises()
        expect(mockUpdateContact.mock.calls[0]![1][key]).toBeNull()

        mockUpdateContact.mockClear()
        await router.push(`/standesdb/contacts/${CONTACT_ID}/edit`)
        await flushPromises()
        await wrapper.find(selector).setValue('  Wert  ')
        await saveButton(wrapper).trigger('click')
        await flushPromises()
        expect(mockUpdateContact.mock.calls[0]![1][key]).toBe('Wert')
      },
    )

    it('confirms a saved change with a toast', async () => {
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
      await flushPromises()

      await saveButton(wrapper).trigger('click')
      await flushPromises()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', detail: 'Änderungen wurden übernommen.' }),
      )
    })
  })

  describe('validation messages', () => {
    const saveButton = (wrapper: Awaited<ReturnType<typeof mountAt>>) =>
      wrapper.findAll('button').find((b) => b.text() === 'Speichern')!

    it('names every field of the form in German in the summary', async () => {
      const labels: Record<string, string> = {
        kontakttyp: 'Kontakttyp',
        anrede: 'Anrede',
        name: 'Name',
        couleurname: 'Couleurname',
        org_id: 'Verbindung (Referenz)',
        adresse_anschrift: 'Adresse (Anschrift)',
        adresse_plz: 'Adresse (PLZ)',
        adresse_ort: 'Adresse (Ort)',
        adresse_land: 'Adresse (Land)',
        zustellungen: 'Zustellungen',
        email: 'E-Mail',
        rufnummer: 'Rufnummer',
        datum: 'Datum',
        datum_accuracy: 'Datum',
        anmerkungen: 'Anmerkungen',
      }
      mockUpdateContact.mockRejectedValueOnce({
        response: {
          data: {
            detail: Object.keys(labels).map((field) => ({
              loc: ['body', field],
              msg: `ungültig (${field})`,
            })),
          },
        },
      })
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
      await flushPromises()

      await saveButton(wrapper).trigger('click')
      await flushPromises()

      const summary = wrapper.find('.error-summary').text()
      Object.entries(labels).forEach(([field, label]) => {
        expect(summary).toContain(`${label}: ungültig (${field})`)
      })
    })

    it('shows the lines of the summary in a toast and no second generic one', async () => {
      mockUpdateContact.mockRejectedValueOnce({
        response: { data: { detail: [{ loc: ['body', 'name'], msg: 'zu lang' }] } },
      })
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
      await flushPromises()

      await saveButton(wrapper).trigger('click')
      await flushPromises()

      expect(mockToastAdd).toHaveBeenCalledTimes(1)
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: 'Validierungsfehler',
          detail: 'Name: zu lang',
        }),
      )
    })

    it('ignores an entry that names no field', async () => {
      mockUpdateContact.mockRejectedValueOnce({
        response: {
          data: { detail: [{ msg: 'ohne Ort' }, { loc: ['body', 'name'], msg: 'zu lang' }] },
        },
      })
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
      await flushPromises()

      await saveButton(wrapper).trigger('click')
      await flushPromises()

      expect(wrapper.find('.error-summary').text()).not.toContain('undefined')
      expect(wrapper.find('.error-summary').text()).toContain('Name: zu lang')
    })

    it('marks the name and the e-mail field as invalid', async () => {
      mockUpdateContact.mockRejectedValueOnce({
        response: {
          data: {
            detail: [
              { loc: ['body', 'name'], msg: 'zu lang' },
              { loc: ['body', 'email'], msg: 'ungültig' },
            ],
          },
        },
      })
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
      await flushPromises()
      expect(wrapper.find('#contact-name').classes()).not.toContain('p-invalid')

      await saveButton(wrapper).trigger('click')
      await flushPromises()

      expect(wrapper.find('#contact-name').classes()).toContain('p-invalid')
      expect(wrapper.find('#contact-email').classes()).toContain('p-invalid')
    })

    it('drops the general messages of an earlier attempt when saving again', async () => {
      mockUpdateContact
        .mockRejectedValueOnce({ response: { data: { detail: ['Allgemeiner Fehler'] } } })
        .mockRejectedValueOnce({ response: { data: { detail: 'Name bereits vergeben.' } } })
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
      await flushPromises()

      await saveButton(wrapper).trigger('click')
      await flushPromises()
      expect(wrapper.find('.error-summary').text()).toContain('Allgemeiner Fehler')
      await saveButton(wrapper).trigger('click')
      await flushPromises()

      expect(wrapper.find('.error-summary').exists()).toBe(false)
    })

    it('drops the general messages when another contact is loaded', async () => {
      mockUpdateContact.mockRejectedValueOnce({
        response: { data: { detail: ['Allgemeiner Fehler'] } },
      })
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
      await flushPromises()
      await saveButton(wrapper).trigger('click')
      await flushPromises()
      expect(wrapper.find('.error-summary').exists()).toBe(true)

      await router.push(`/standesdb/contacts/${OTHER_CONTACT_ID}/edit`)
      await flushPromises()

      expect(wrapper.find('.error-summary').exists()).toBe(false)
    })
  })

  describe('a load that fails', () => {
    it('regression: shows no form for an existing contact when the contact cannot be loaded', async () => {
      mockGetContact.mockRejectedValue({ response: { status: 500 } })
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
      await flushPromises()

      expect(wrapper.text()).toContain('Der Kontakt konnte nicht geladen werden.')
      expect(wrapper.find('#contact-name').exists()).toBe(false)
      expect(wrapper.findAll('button').some((b) => b.text() === 'Speichern')).toBe(false)
    })

    it('regression: shows no form when only the reference data cannot be loaded', async () => {
      mockGetReferenceData.mockRejectedValue(new Error('offline'))
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
      await flushPromises()

      expect(wrapper.text()).toContain('Der Kontakt konnte nicht geladen werden.')
      expect(mockUpdateContact).not.toHaveBeenCalled()
    })

    it('names the failure of the create form as such', async () => {
      mockGetReferenceData.mockRejectedValue(new Error('offline'))
      const wrapper = await mountAt('/standesdb/contacts/new')
      await flushPromises()

      expect(wrapper.text()).toContain('Das Formular konnte nicht geladen werden.')
    })

    it('loads the form after "Erneut versuchen"', async () => {
      mockGetContact.mockRejectedValueOnce({ response: { status: 500 } })
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
      await flushPromises()

      await wrapper
        .findAll('button')
        .find((b) => b.text() === 'Erneut versuchen')!
        .trigger('click')
      await flushPromises()

      expect((wrapper.find('#contact-name').element as HTMLInputElement).value).toBe('Firma GmbH')
      expect(wrapper.text()).not.toContain('konnte nicht geladen werden')
    })

    it('redirects to not-found on a 403', async () => {
      mockGetContact.mockRejectedValueOnce({ response: { status: 403 } })
      await mountAt(`/standesdb/contacts/${OTHER_CONTACT_ID}/edit`)
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('not-found')
    })
  })

  describe('a change of the address while the form is open', () => {
    it('regression: loads the other contact instead of saving the old form onto it', async () => {
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
      await flushPromises()
      mockGetContact.mockResolvedValue({
        data: buildContact({ id: OTHER_CONTACT_ID, name: 'Andere GmbH', email: 'andere@firma.at' }),
      })

      await router.push(`/standesdb/contacts/${OTHER_CONTACT_ID}/edit`)
      await flushPromises()
      await wrapper
        .findAll('button')
        .find((b) => b.text() === 'Speichern')!
        .trigger('click')
      await flushPromises()

      expect(mockGetContact).toHaveBeenLastCalledWith(OTHER_CONTACT_ID)
      expect(mockUpdateContact).toHaveBeenCalledWith(
        OTHER_CONTACT_ID,
        expect.objectContaining({ name: 'Andere GmbH', email: 'andere@firma.at' }),
      )
    })

    it('regression: a slow answer for the contact that was left does not fill the form', async () => {
      let releaseFirst: (value: unknown) => void = () => {}
      mockGetContact
        .mockReturnValueOnce(new Promise((resolve) => (releaseFirst = resolve)))
        .mockResolvedValueOnce({
          data: buildContact({ id: OTHER_CONTACT_ID, name: 'Zweite GmbH' }),
        })
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)

      await router.push(`/standesdb/contacts/${OTHER_CONTACT_ID}/edit`)
      await flushPromises()
      releaseFirst({ data: buildContact({ name: 'Erste GmbH' }) })
      await flushPromises()

      expect((wrapper.find('#contact-name').element as HTMLInputElement).value).toBe('Zweite GmbH')
    })

    it('regression: a late failure for the contact that was left does not replace the form', async () => {
      let failFirst: (reason: unknown) => void = () => {}
      mockGetContact
        .mockReturnValueOnce(new Promise((_resolve, reject) => (failFirst = reject)))
        .mockResolvedValueOnce({
          data: buildContact({ id: OTHER_CONTACT_ID, name: 'Zweite GmbH' }),
        })
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)

      await router.push(`/standesdb/contacts/${OTHER_CONTACT_ID}/edit`)
      await flushPromises()
      failFirst({ response: { status: 500 } })
      await flushPromises()

      expect(wrapper.text()).not.toContain('konnte nicht geladen werden')
      expect((wrapper.find('#contact-name').element as HTMLInputElement).value).toBe('Zweite GmbH')
    })

    it('regression: keeps the form away while the newer contact loads when the older answer arrives', async () => {
      let releaseFirst: (value: unknown) => void = () => {}
      mockGetContact
        .mockReturnValueOnce(new Promise((resolve) => (releaseFirst = resolve)))
        .mockReturnValueOnce(new Promise(() => {}))
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)

      await router.push(`/standesdb/contacts/${OTHER_CONTACT_ID}/edit`)
      await flushPromises()
      releaseFirst({ data: buildContact({ name: 'Erste GmbH' }) })
      await flushPromises()

      expect(wrapper.find('#contact-name').exists()).toBe(false)
    })

    it('starts a blank form when the address changes from an edit to the create page', async () => {
      const wrapper = await mountAt(`/standesdb/contacts/${CONTACT_ID}/edit`)
      await flushPromises()

      await router.push('/standesdb/contacts/new')
      await flushPromises()

      expect(wrapper.text()).toContain('Neuen Kontakt anlegen')
      expect((wrapper.find('#contact-name').element as HTMLInputElement).value).toBe('')
      expect(mockGetContact).toHaveBeenCalledTimes(1)
    })
  })
})
