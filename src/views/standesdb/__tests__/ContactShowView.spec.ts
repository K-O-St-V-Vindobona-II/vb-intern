import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ContactShowView from '../ContactShowView.vue'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import { createRouter, createMemoryHistory } from 'vue-router'

function buildContact(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
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
    mockAuthStore.user.permissions = ['standesdbContactAdmin']
    mockGetContact.mockResolvedValue({ data: buildContact() })
    mockDeleteContact.mockResolvedValue({})
    mockGetChangelog.mockResolvedValue({ data: { items: [], total: 0 } })
  })

  const mountView = async () => {
    await router.push('/standesdb/contacts/1')
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
    expect(mockConfirmRequire.mock.calls[0][0].header).toBe('Kontakt löschen')
  })

  it('calls deleteContact on confirm accept', async () => {
    const w = await mountView()
    const deleteBtn = w.findAll('button').find((b) => b.text().includes('Löschen'))
    await deleteBtn!.trigger('click')

    const acceptFn = mockConfirmRequire.mock.calls[0][0].accept
    await acceptFn()
    expect(mockDeleteContact).toHaveBeenCalledWith(1)
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Kontakt gelöscht' }),
    )
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
            id: 1,
            modified_at: '2026-01-01T10:00:00Z',
            modified_by_name: 'Admin',
            action: 'store',
            key: 'name',
            old: 'Alt',
            new: 'Neu',
          },
          {
            id: 2,
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

    expect(mockGetChangelog).toHaveBeenCalledWith('contact', 1, { page: 1, page_size: 25 })
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

    expect(mockGetChangelog).toHaveBeenLastCalledWith('contact', 1, { page: 2, page_size: 25 })
  })

  it('silently ignores a changelog load failure', async () => {
    mockGetChangelog.mockRejectedValue({ response: { status: 403 } })
    const w = await mountView()

    await w.find('.changelog-header').trigger('click')
    await flushPromises()

    expect(w.find('.changelog-header').exists()).toBe(true)
  })

  it('shows an error toast when deleting fails', async () => {
    mockDeleteContact.mockRejectedValue({ response: { data: { detail: 'Verknüpft.' } } })
    const w = await mountView()
    const deleteBtn = w.findAll('button').find((b) => b.text().includes('Löschen'))
    await deleteBtn!.trigger('click')

    const acceptFn = mockConfirmRequire.mock.calls[0][0].accept
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
    expect(mockGetContact).toHaveBeenCalledWith(1)

    mockGetContact.mockResolvedValue({ data: buildContact({ id: 2, cn: 'Andere Person' }) })
    await router.push('/standesdb/contacts/2')
    await flushPromises()

    expect(mockGetContact).toHaveBeenCalledWith(2)
    expect(w.text()).toContain('Andere Person')
  })
})
