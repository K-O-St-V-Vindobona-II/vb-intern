import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ContactShowView from '../ContactShowView.vue'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import { createRouter, createMemoryHistory } from 'vue-router'

const CONTACT_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_ID = '22222222-2222-2222-2222-222222222222'

// The router is shared between the cases: a wrapper left mounted by an earlier case would react
// to the address changes of a later one.

function buildContact(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTACT_ID,
    cn: 'Peter Fiala v/o Nepomuk',
    kontakttyp: 'person',
    anrede: 'Herrn',
    name: 'Peter Fiala',
    couleurname: 'Nepomuk',
    org_id: 'vbn',
    org_label: 'K.Ö.St.V. Vindobona nova',
    adresse_anschrift: 'Teststr. 1',
    adresse_plz: '1070',
    adresse_ort: 'Wien',
    adresse_land: null,
    zustellungen: true,
    email: 'peter@test.at',
    rufnummer: '+43699123456',
    datum: '1970-03-05',
    datum_accuracy: 3,
    default_image: null,
    anmerkungen: 'Testanmerkung',
    ...overrides,
  }
}

const mockGetContact = vi.fn()
const mockDeleteContact = vi.fn()
const mockGetChangelog = vi.fn()
vi.mock('@/services/standesdbService', () => ({
  default: {
    getContact: (...args: unknown[]) => mockGetContact(...args),
    deleteContact: (...args: unknown[]) => mockDeleteContact(...args),
    getChangelog: (...args: unknown[]) => mockGetChangelog(...args),
  },
}))

vi.mock('@/services/api', () => ({
  default: { get: vi.fn().mockRejectedValue(new Error('no image')) },
}))

const mockAuthStore = {
  user: { permissions: ['standesdbContactAdmin'] },
}
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

const mockConfirmRequire = vi.fn()
vi.mock('primevue/useconfirm', () => ({
  useConfirm: vi.fn(() => ({ require: mockConfirmRequire })),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/standesdb/contacts/:id', name: 'standesdb-contact-show', component: ContactShowView },
    {
      path: '/standesdb/contacts/:id/edit',
      name: 'standesdb-contact-edit',
      component: { template: '<div />' },
    },
    {
      path: '/standesdb/contacts/:id/images',
      name: 'standesdb-contact-images',
      component: { template: '<div />' },
    },
    { path: '/standesdb', name: 'standesdb-dashboard', component: { template: '<div />' } },
    { path: '/not-found', name: 'not-found', component: { template: '<div />' } },
  ],
})

describe('ContactShowView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // clearAllMocks keeps implementations and queued once-values of earlier cases.
    mockGetContact.mockReset()
    mockGetChangelog.mockReset()
    mockAuthStore.user.permissions = ['standesdbContactAdmin']
    mockGetContact.mockResolvedValue({ data: buildContact() })
    mockDeleteContact.mockResolvedValue({})
    mockGetChangelog.mockResolvedValue({ data: { items: [], total: 0 } })
  })

  const mountView = async () => {
    await router.push(`/standesdb/contacts/${CONTACT_ID}`)
    await router.isReady()
    const w = mount(ContactShowView, {
      global: {
        plugins: [PrimeVue, ConfirmationService, ToastService, router, createPinia()],
        stubs: { ConfirmDialog: true },
      },
    })
    await flushPromises()
    return w
  }

  it('renders page title', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Kontakt')
  })

  it('renders contact name', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Peter Fiala v/o Nepomuk')
  })

  it('renders kontakttyp as Person', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Person')
  })

  it('renders email as mailto link', async () => {
    const w = await mountView()
    const link = w.find('a[href="mailto:peter@test.at"]')
    expect(link.exists()).toBe(true)
  })

  it('renders phone as tel link', async () => {
    const w = await mountView()
    const link = w.find('a[href="tel:+43699123456"]')
    expect(link.exists()).toBe(true)
  })

  it('renders org label correctly', async () => {
    const w = await mountView()
    expect(w.text()).toContain('K.Ö.St.V. Vindobona nova')
  })

  it('renders anmerkungen', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Testanmerkung')
  })

  it('shows edit button for admin', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Bearbeiten')
  })

  it('shows delete button for admin', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Löschen')
  })

  it('renders zustellungen checkbox as checked', async () => {
    const w = await mountView()
    expect(w.text()).toContain('☑')
    expect(w.text()).toContain('Zustellungen')
  })

  it('triggers confirm dialog on delete click', async () => {
    const w = await mountView()
    const deleteBtn = w.findAll('button').find((b) => b.text().includes('Löschen'))
    expect(deleteBtn).toBeTruthy()
    await deleteBtn!.trigger('click')
    expect(mockConfirmRequire).toHaveBeenCalledOnce()
    expect(mockConfirmRequire.mock.calls[0]![0].header).toBe('Kontakt löschen')
  })

  it('calls deleteContact on confirm accept', async () => {
    const w = await mountView()
    const deleteBtn = w.findAll('button').find((b) => b.text().includes('Löschen'))
    await deleteBtn!.trigger('click')

    const acceptFn = mockConfirmRequire.mock.calls[0]![0].accept
    await acceptFn()
    await flushPromises()
    expect(mockDeleteContact).toHaveBeenCalledWith(CONTACT_ID)
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Kontakt gelöscht' }),
    )
    expect(router.currentRoute.value.name).toBe('standesdb-dashboard')
  })

  it('shows changelog section for standesdbContactAdmin', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Änderungshistorie')
  })

  it('hides changelog section for systemAdmin without standesdbContactAdmin', async () => {
    const original = mockAuthStore.user.permissions
    mockAuthStore.user.permissions = ['systemAdmin']
    try {
      const w = await mountView()
      expect(w.text()).not.toContain('Änderungshistorie')
    } finally {
      mockAuthStore.user.permissions = original
    }
  })

  it('loads the changelog on first toggle and shows action severities', async () => {
    mockGetChangelog.mockResolvedValue({
      data: {
        items: [
          {
            id: 'log-1',
            modified_at: '2026-01-01T10:00:00Z',
            modified_by_name: 'Admin',
            action: 'store',
            key: 'name',
            old: 'Alt',
            new: 'Neu',
          },
          {
            id: 'log-2',
            modified_at: null,
            modified_by_name: null,
            action: 'delete',
            key: 'zustellungen',
            old: null,
            new: null,
          },
        ],
        total: 2,
      },
    })
    const w = await mountView()

    await w.find('.changelog-header').trigger('click')
    await flushPromises()

    expect(mockGetChangelog).toHaveBeenCalledWith('contact', CONTACT_ID, { page: 1, page_size: 25 })
    expect(w.text()).toContain('Admin')
    const tags = w.findAllComponents({ name: 'Tag' })
    const actionTags = tags.filter((t) => ['store', 'delete'].includes(t.props('value')))
    expect(actionTags.find((t) => t.props('value') === 'store')?.props('severity')).toBe('success')
    expect(actionTags.find((t) => t.props('value') === 'delete')?.props('severity')).toBe('danger')
  })

  it('does not reload the changelog on a second toggle', async () => {
    const w = await mountView()

    await w.find('.changelog-header').trigger('click')
    await flushPromises()
    await w.find('.changelog-header').trigger('click')
    await w.find('.changelog-header').trigger('click')
    await flushPromises()

    expect(mockGetChangelog).toHaveBeenCalledTimes(1)
  })

  it('requests the next page of the changelog', async () => {
    mockGetChangelog.mockResolvedValue({ data: { items: [], total: 60 } })
    const w = await mountView()
    await w.find('.changelog-header').trigger('click')
    await flushPromises()

    const table = w.findComponent({ name: 'DataTable' })
    await table.vm.$emit('page', { page: 1 })
    await flushPromises()

    expect(mockGetChangelog).toHaveBeenLastCalledWith('contact', CONTACT_ID, {
      page: 2,
      page_size: 25,
    })
  })

  it('shows a failed changelog load in place of the table and keeps the page', async () => {
    mockGetChangelog.mockRejectedValue({ response: { status: 500 } })
    const w = await mountView()

    await w.find('.changelog-header').trigger('click')
    await flushPromises()

    expect(w.find('.changelog-header').exists()).toBe(true)
    expect(w.text()).toContain('Die Änderungshistorie konnte nicht geladen werden.')
    expect(w.findComponent({ name: 'DataTable' }).exists()).toBe(false)
  })

  it('regression: loads the changelog again after "Erneut versuchen"', async () => {
    mockGetChangelog.mockRejectedValueOnce({ response: { status: 500 } })
    const w = await mountView()
    await w.find('.changelog-header').trigger('click')
    await flushPromises()
    mockGetChangelog.mockResolvedValue({
      data: {
        items: [
          {
            id: 'log-1',
            modified_at: '2026-01-01T10:00:00Z',
            modified_by_name: 'Admin',
            action: 'update',
            key: 'name',
            old: 'Alt',
            new: 'Neu',
          },
        ],
        total: 1,
      },
    })

    await w
      .findAll('button')
      .find((b) => b.text() === 'Erneut versuchen')!
      .trigger('click')
    await flushPromises()

    expect(w.text()).not.toContain('konnte nicht geladen werden')
    expect(w.text()).toContain('Admin')
  })

  it('offers the changelog toggle as a button that reports its state', async () => {
    const w = await mountView()
    const toggle = w.find('.changelog-header')

    expect(toggle.element.tagName).toBe('BUTTON')
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')
    await flushPromises()

    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(w.find(`#${toggle.attributes('aria-controls')}`).exists()).toBe(true)
    expect(w.findComponent({ name: 'DataTable' }).props('loading')).toBe(false)
  })

  it('opens the edit page and the image page of the contact', async () => {
    const w = await mountView()

    await w
      .findAll('button')
      .find((b) => b.text().includes('Bearbeiten'))!
      .trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('standesdb-contact-edit')
    expect(router.currentRoute.value.params['id']).toBe(CONTACT_ID)

    await router.push(`/standesdb/contacts/${CONTACT_ID}`)
    await flushPromises()
    await w
      .findAll('button')
      .find((b) => b.text().includes('Alle Profilbilder'))!
      .trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('standesdb-contact-images')
  })

  describe.each([
    ['upper', 0],
    ['lower', -1],
  ])('the %s row of buttons', (_name, position) => {
    const press = async (w: Awaited<ReturnType<typeof mountView>>, label: string) => {
      await w
        .findAll('button')
        .filter((b) => b.text().includes(label))
        .at(position)!
        .trigger('click')
      await flushPromises()
    }

    it.each([
      ['Bearbeiten', 'standesdb-contact-edit'],
      ['Alle Profilbilder', 'standesdb-contact-images'],
      ['Zur Suche', 'standesdb-dashboard'],
    ])('opens the page behind "%s"', async (label, routeName) => {
      const w = await mountView()

      await press(w, label)

      expect(router.currentRoute.value.name).toBe(routeName)
    })
  })

  describe('state that belongs to one contact', () => {
    const changelogOf = (key: string) => ({
      data: {
        items: [
          {
            id: `log-${key}`,
            modified_at: '2026-01-01T10:00:00Z',
            modified_by_name: `Bearbeiter ${key}`,
            action: 'update',
            key,
            old: null,
            new: 'x',
          },
        ],
        total: 1,
      },
    })

    it('regression: does not show the history of the previous contact under the next one', async () => {
      mockGetChangelog.mockResolvedValue(changelogOf('erste'))
      const w = await mountView()
      await w.find('.changelog-header').trigger('click')
      await flushPromises()
      expect(w.text()).toContain('Bearbeiter erste')

      mockGetContact.mockResolvedValue({
        data: buildContact({ id: OTHER_ID, cn: 'Andere Person' }),
      })
      await router.push(`/standesdb/contacts/${OTHER_ID}`)
      await flushPromises()

      expect(w.text()).toContain('Andere Person')
      expect(w.text()).not.toContain('Bearbeiter erste')
      expect(w.findComponent({ name: 'DataTable' }).exists()).toBe(false)

      mockGetChangelog.mockResolvedValue(changelogOf('zweite'))
      await w.find('.changelog-header').trigger('click')
      await flushPromises()
      expect(mockGetChangelog).toHaveBeenLastCalledWith('contact', OTHER_ID, {
        page: 1,
        page_size: 25,
      })
      expect(w.text()).toContain('Bearbeiter zweite')
    })

    it('regression: a confirmed delete hits the contact the dialog named', async () => {
      const w = await mountView()
      await w
        .findAll('button')
        .find((b) => b.text().includes('Löschen'))!
        .trigger('click')
      const confirmOptions = mockConfirmRequire.mock.calls[0]![0]

      mockGetContact.mockResolvedValue({
        data: buildContact({ id: OTHER_ID, cn: 'Andere Person' }),
      })
      await router.push(`/standesdb/contacts/${OTHER_ID}`)
      await flushPromises()
      await confirmOptions.accept()

      expect(confirmOptions.message).toContain('Peter Fiala v/o Nepomuk')
      expect(mockDeleteContact).toHaveBeenCalledWith(CONTACT_ID)
      expect(w.text()).toContain('Andere Person')
    })

    it('regression: a slow answer for the contact that was left does not replace the new one', async () => {
      let releaseFirst: (value: unknown) => void = () => {}
      mockGetContact
        .mockReturnValueOnce(new Promise((resolve) => (releaseFirst = resolve)))
        .mockResolvedValueOnce({ data: buildContact({ id: OTHER_ID, cn: 'Zweite Person' }) })
      await router.push(`/standesdb/contacts/${CONTACT_ID}`)
      const w = mount(ContactShowView, {
        global: {
          plugins: [PrimeVue, ConfirmationService, ToastService, router, createPinia()],
          stubs: { ConfirmDialog: true },
        },
      })
      await router.push(`/standesdb/contacts/${OTHER_ID}`)
      await flushPromises()
      releaseFirst({ data: buildContact({ cn: 'Erste Person' }) })
      await flushPromises()

      expect(w.text()).toContain('Zweite Person')
      expect(w.text()).not.toContain('Erste Person')
    })

    it('regression: a 404 for the contact that was left does not move the user off the new one', async () => {
      let rejectFirst: (reason: unknown) => void = () => {}
      mockGetContact
        .mockReturnValueOnce(new Promise((_resolve, reject) => (rejectFirst = reject)))
        .mockResolvedValueOnce({ data: buildContact({ id: OTHER_ID, cn: 'Zweite Person' }) })
      await router.push(`/standesdb/contacts/${CONTACT_ID}`)
      mount(ContactShowView, {
        global: {
          plugins: [PrimeVue, ConfirmationService, ToastService, router, createPinia()],
          stubs: { ConfirmDialog: true },
        },
      })
      await router.push(`/standesdb/contacts/${OTHER_ID}`)
      await flushPromises()
      rejectFirst({ response: { status: 404 } })
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('standesdb-contact-show')
    })

    it('regression: a late history of the contact that was left is not taken for the next contact', async () => {
      let releaseFirst: (value: unknown) => void = () => {}
      mockGetChangelog.mockReturnValueOnce(new Promise((resolve) => (releaseFirst = resolve)))
      const w = await mountView()
      await w.find('.changelog-header').trigger('click')
      await flushPromises()

      mockGetContact.mockResolvedValue({
        data: buildContact({ id: OTHER_ID, cn: 'Andere Person' }),
      })
      await router.push(`/standesdb/contacts/${OTHER_ID}`)
      await flushPromises()
      releaseFirst(changelogOf('erste'))
      await flushPromises()
      mockGetChangelog.mockResolvedValue(changelogOf('zweite'))
      await w.find('.changelog-header').trigger('click')
      await flushPromises()

      expect(mockGetChangelog).toHaveBeenLastCalledWith('contact', OTHER_ID, {
        page: 1,
        page_size: 25,
      })
      expect(w.text()).toContain('Bearbeiter zweite')
      expect(w.text()).not.toContain('Bearbeiter erste')
    })

    it('shows no rows of the previous contact while the next history loads', async () => {
      mockGetChangelog.mockResolvedValue(changelogOf('erste'))
      const w = await mountView()
      await w.find('.changelog-header').trigger('click')
      await flushPromises()

      mockGetContact.mockResolvedValue({
        data: buildContact({ id: OTHER_ID, cn: 'Andere Person' }),
      })
      await router.push(`/standesdb/contacts/${OTHER_ID}`)
      await flushPromises()
      mockGetChangelog.mockReturnValue(new Promise(() => {}))
      await w.find('.changelog-header').trigger('click')
      await flushPromises()

      const table = w.findComponent({ name: 'DataTable' })
      expect(w.text()).not.toContain('Bearbeiter erste')
      expect(table.props('totalRecords')).toBe(0)
      expect(table.props('loading')).toBe(true)
    })

    it('regression: a slow changelog page that fails late does not show an error over a newer page', async () => {
      let failFirst: (reason: unknown) => void = () => {}
      mockGetChangelog
        .mockReturnValueOnce(new Promise((_resolve, reject) => (failFirst = reject)))
        .mockResolvedValueOnce(changelogOf('neu'))
      const w = await mountView()
      await w.find('.changelog-header').trigger('click')
      await flushPromises()

      await w.findComponent({ name: 'DataTable' }).vm.$emit('page', { page: 1 })
      await flushPromises()
      failFirst(new Error('offline'))
      await flushPromises()

      expect(w.find('.changelog-error').exists()).toBe(false)
      expect(w.text()).toContain('Bearbeiter neu')
    })

    it('keeps the loading state while a newer changelog page is still on its way', async () => {
      let releaseFirst: (value: unknown) => void = () => {}
      mockGetChangelog
        .mockReturnValueOnce(new Promise((resolve) => (releaseFirst = resolve)))
        .mockReturnValueOnce(new Promise(() => {}))
      const w = await mountView()
      await w.find('.changelog-header').trigger('click')
      await flushPromises()

      await w.findComponent({ name: 'DataTable' }).vm.$emit('page', { page: 1 })
      await flushPromises()
      releaseFirst(changelogOf('alt'))
      await flushPromises()

      expect(w.findComponent({ name: 'DataTable' }).props('loading')).toBe(true)
    })

    it('regression: a slow changelog page does not replace a newer one', async () => {
      let releaseFirst: (value: unknown) => void = () => {}
      mockGetChangelog
        .mockReturnValueOnce(new Promise((resolve) => (releaseFirst = resolve)))
        .mockResolvedValueOnce(changelogOf('neu'))
      const w = await mountView()
      await w.find('.changelog-header').trigger('click')
      await flushPromises()

      await w.findComponent({ name: 'DataTable' }).vm.$emit('page', { page: 1 })
      await flushPromises()
      releaseFirst(changelogOf('alt'))
      await flushPromises()

      expect(w.text()).toContain('Bearbeiter neu')
      expect(w.text()).not.toContain('Bearbeiter alt')
    })
  })

  describe('a load that fails for another reason than 403 or 404', () => {
    it('regression: says so instead of showing a blank page', async () => {
      mockGetContact.mockRejectedValue({ response: { status: 500 } })
      const w = await mountView()

      expect(w.text()).toContain('Der Kontakt konnte nicht geladen werden.')
      expect(router.currentRoute.value.name).toBe('standesdb-contact-show')
    })

    it('loads the contact after "Erneut versuchen"', async () => {
      mockGetContact.mockRejectedValueOnce({ response: { status: 500 } })
      const w = await mountView()

      await w
        .findAll('button')
        .find((b) => b.text() === 'Erneut versuchen')!
        .trigger('click')
      await flushPromises()

      expect(w.text()).toContain('Peter Fiala v/o Nepomuk')
      expect(w.text()).not.toContain('konnte nicht geladen werden')
    })
  })

  it('shows an error toast when deleting fails', async () => {
    mockDeleteContact.mockRejectedValue({ response: { data: { detail: 'Verknüpft.' } } })
    const w = await mountView()
    const deleteBtn = w.findAll('button').find((b) => b.text().includes('Löschen'))
    await deleteBtn!.trigger('click')

    const acceptFn = mockConfirmRequire.mock.calls[0]![0].accept
    await acceptFn()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Verknüpft.' }),
    )
  })

  it('redirects to not-found on a 404', async () => {
    mockGetContact.mockRejectedValueOnce({ response: { status: 404 } })
    const w = await mountView()
    expect(w).toBeTruthy()
    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('redirects to not-found on a 403', async () => {
    mockGetContact.mockRejectedValueOnce({ response: { status: 403 } })
    await mountView()
    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('falls back to the uppercased org id when no org label is set', async () => {
    mockGetContact.mockResolvedValue({ data: buildContact({ org_label: null, org_id: 'vbn' }) })
    const w = await mountView()
    expect(w.text()).toContain('VBN')
  })

  it('reloads the contact when the route id changes', async () => {
    const w = await mountView()
    expect(mockGetContact).toHaveBeenCalledWith(CONTACT_ID)

    mockGetContact.mockResolvedValue({ data: buildContact({ id: OTHER_ID, cn: 'Andere Person' }) })
    await router.push(`/standesdb/contacts/${OTHER_ID}`)
    await flushPromises()

    expect(mockGetContact).toHaveBeenCalledWith(OTHER_ID)
    expect(w.text()).toContain('Andere Person')
  })
})
