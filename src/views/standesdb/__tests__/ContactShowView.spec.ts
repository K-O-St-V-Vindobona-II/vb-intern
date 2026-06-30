import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ContactShowView from '../ContactShowView.vue'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('@/services/standesdbService', () => ({
  default: {
    getContact: vi.fn().mockResolvedValue({
      data: {
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
      },
    }),
    deleteContact: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/services/api', () => ({
  default: { get: vi.fn().mockRejectedValue(new Error('no image')) },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { permissions: ['standesdbContactAdmin'] },
  })),
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
  ],
})

describe('ContactShowView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
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
    const standesdbService = await import('@/services/standesdbService')
    const w = await mountView()
    const deleteBtn = w.findAll('button').find((b) => b.text().includes('Löschen'))
    await deleteBtn!.trigger('click')

    const acceptFn = mockConfirmRequire.mock.calls[0][0].accept
    await acceptFn()
    expect(standesdbService.default.deleteContact).toHaveBeenCalledWith(1)
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Kontakt gelöscht' }),
    )
  })
})
