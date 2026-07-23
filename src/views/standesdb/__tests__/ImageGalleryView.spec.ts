import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ImageGalleryView from '../ImageGalleryView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('@/services/standesdbService', () => ({
  default: {
    getMemberImages: vi.fn().mockResolvedValue({
      data: {
        owner: { cn: 'Max Muster', default_image: 1, org_id: 'vbw' },
        images: [
          {
            id: 1,
            type: 'image/jpeg',
            height: 200,
            width: 150,
            size: 45000,
            description: 'Profilbild',
            default: true,
          },
          {
            id: 2,
            type: 'image/png',
            height: 100,
            width: 100,
            size: 12000,
            description: null,
            default: false,
          },
        ],
      },
    }),
    getContactImages: vi.fn().mockResolvedValue({
      data: { owner: { cn: 'Kontakt Test', default_image: null }, images: [] },
    }),
    uploadImage: vi.fn().mockResolvedValue({ data: { id: 3 } }),
    updateImage: vi.fn().mockResolvedValue({ data: {} }),
    deleteImage: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error('no blob')),
    defaults: { baseURL: 'https://api.test.at/api' },
  },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { permissions: ['standesdbVbwAdmin', 'standesdbContactAdmin'] },
    token: 'test-token',
  })),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/standesdb/members/:id/images',
      name: 'standesdb-member-images',
      component: ImageGalleryView,
    },
    {
      path: '/standesdb/contacts/:id/images',
      name: 'standesdb-contact-images',
      component: ImageGalleryView,
    },
    {
      path: '/standesdb/members/:id',
      name: 'standesdb-member-show',
      component: { template: '<div />' },
    },
    {
      path: '/standesdb/contacts/:id',
      name: 'standesdb-contact-show',
      component: { template: '<div />' },
    },
  ],
})

describe('ImageGalleryView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const mountMemberGallery = async () => {
    await router.push('/standesdb/members/1/images')
    await router.isReady()
    const w = mount(ImageGalleryView, {
      global: { plugins: [PrimeVue, ToastService, router, createPinia()] },
    })
    await flushPromises()
    return w
  }

  it('renders page title and owner CN', async () => {
    const w = await mountMemberGallery()
    expect(w.text()).toContain('Profilbilder')
    expect(w.text()).toContain('Max Muster')
  })

  it('shows image count', async () => {
    const w = await mountMemberGallery()
    expect(w.text()).toContain('2 Profilbilder')
  })

  it('shows image metadata', async () => {
    const w = await mountMemberGallery()
    expect(w.text()).toContain('150 × 200')
    expect(w.text()).toContain('44 KB')
  })

  it('shows Standard badge for default image', async () => {
    const w = await mountMemberGallery()
    expect(w.text()).toContain('Standard')
  })

  it('shows description or fallback', async () => {
    const w = await mountMemberGallery()
    expect(w.text()).toContain('Profilbild')
    expect(w.text()).toContain('Keine Beschreibung')
  })

  it('shows upload section for admin', async () => {
    const w = await mountMemberGallery()
    expect(w.text()).toContain('Neues Bild hochladen')
  })

  it('shows download button', async () => {
    const w = await mountMemberGallery()
    expect(w.text()).toContain('Download')
  })

  it('shows edit and delete buttons for admin', async () => {
    const w = await mountMemberGallery()
    expect(w.text()).toContain('Bearbeiten')
    expect(w.text()).toContain('Löschen')
  })

  it('shows back button', async () => {
    const w = await mountMemberGallery()
    expect(w.text()).toContain('Zurück')
  })
})
