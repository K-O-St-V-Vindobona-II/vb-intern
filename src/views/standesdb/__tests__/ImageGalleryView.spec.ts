import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ImageGalleryView from '../ImageGalleryView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { createRouter, createMemoryHistory } from 'vue-router'

const mockGetMemberImages = vi.fn()
const mockGetContactImages = vi.fn()
const mockGetOwnImages = vi.fn()
const mockUploadImage = vi.fn()
const mockUpdateImage = vi.fn()
const mockDeleteImage = vi.fn()
const mockUploadOwnImage = vi.fn()
const mockUpdateOwnImage = vi.fn()
const mockDeleteOwnImage = vi.fn()
const mockGetImageUrl = vi.fn()

vi.mock('@/services/standesdbService', () => ({
  default: {
    getMemberImages: (...args: unknown[]) => mockGetMemberImages(...args),
    getContactImages: (...args: unknown[]) => mockGetContactImages(...args),
    getOwnImages: (...args: unknown[]) => mockGetOwnImages(...args),
    uploadImage: (...args: unknown[]) => mockUploadImage(...args),
    updateImage: (...args: unknown[]) => mockUpdateImage(...args),
    deleteImage: (...args: unknown[]) => mockDeleteImage(...args),
    uploadOwnImage: (...args: unknown[]) => mockUploadOwnImage(...args),
    updateOwnImage: (...args: unknown[]) => mockUpdateOwnImage(...args),
    deleteOwnImage: (...args: unknown[]) => mockDeleteOwnImage(...args),
    getImageUrl: (...args: unknown[]) => mockGetImageUrl(...args),
  },
}))

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error('no blob')),
    defaults: { baseURL: 'https://api.test.at/api' },
  },
}))

let mockPermissions: string[] = ['standesdbVbwAdmin', 'standesdbContactAdmin']
// Deliberately different from the mocked gallery owner id (1) by default -
// most existing tests exercise the "viewing someone else's gallery" case,
// tests that need "isSelf" true set this explicitly to 1.
let mockUserId = 99
const mockFetchUser = vi.fn()
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: mockUserId, permissions: mockPermissions },
    token: 'test-token',
    fetchUser: mockFetchUser,
  })),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

function buildImages() {
  return [
    {
      id: 'image-uuid-1',
      type: 'image/jpeg',
      height: 200,
      width: 150,
      size: 45000,
      description: 'Profilbild',
      default: true,
    },
    {
      id: 'image-uuid-2',
      type: 'image/png',
      height: 100,
      width: 100,
      size: 12000,
      description: null,
      default: false,
    },
  ]
}

function makeFile(name: string, sizeBytes: number, type = 'image/jpeg'): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

function setInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true })
}

function clickButton(text: string) {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text)!
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function clickDialogButton(text: string) {
  const dialog = document.querySelector('.p-dialog')
  const btn = Array.from(dialog?.querySelectorAll('button') ?? []).find(
    (b) => b.textContent === text,
  )!
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/standesdb/members/me/images',
        name: 'standesdb-my-images',
        component: ImageGalleryView,
      },
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
      { path: '/not-found', name: 'not-found', component: { template: '<div />' } },
    ],
  })
}

describe('ImageGalleryView', () => {
  let currentRouter: ReturnType<typeof router>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockPermissions = ['standesdbVbwAdmin', 'standesdbContactAdmin']
    mockUserId = 99
    mockGetMemberImages.mockResolvedValue({
      data: {
        owner: { cn: 'Max Muster', default_image: 'image-uuid-1', org_id: 'vbw' },
        images: buildImages(),
      },
    })
    mockGetContactImages.mockResolvedValue({
      data: { owner: { cn: 'Kontakt Test', default_image: null }, images: [] },
    })
    mockGetOwnImages.mockResolvedValue({
      data: {
        owner: { cn: 'Max Muster', default_image: 'image-uuid-1', org_id: 'vbw' },
        images: buildImages(),
      },
    })
    mockGetImageUrl.mockRejectedValue(new Error('no preview'))
    mockUploadImage.mockResolvedValue({ data: { id: 'image-uuid-3' } })
    mockUpdateImage.mockResolvedValue({ data: {} })
    mockDeleteImage.mockResolvedValue({ data: {} })
    mockUploadOwnImage.mockResolvedValue({ data: { id: 'image-uuid-3' } })
    mockUpdateOwnImage.mockResolvedValue({ data: {} })
    mockDeleteOwnImage.mockResolvedValue({ data: {} })
    currentRouter = router()
  })

  const mountMemberGallery = async (attachTo: Element | undefined = undefined) => {
    await currentRouter.push('/standesdb/members/1/images')
    await currentRouter.isReady()
    const w = mount(ImageGalleryView, {
      global: { plugins: [PrimeVue, ToastService, currentRouter, createPinia()] },
      attachTo,
    })
    await flushPromises()
    return w
  }

  const mountContactGallery = async (attachTo: Element | undefined = undefined) => {
    await currentRouter.push('/standesdb/contacts/1/images')
    await currentRouter.isReady()
    const w = mount(ImageGalleryView, {
      global: { plugins: [PrimeVue, ToastService, currentRouter, createPinia()] },
      attachTo,
    })
    await flushPromises()
    return w
  }

  const mountOwnGallery = async (attachTo: Element | undefined = undefined) => {
    await currentRouter.push('/standesdb/members/me/images')
    await currentRouter.isReady()
    const w = mount(ImageGalleryView, {
      global: { plugins: [PrimeVue, ToastService, currentRouter, createPinia()] },
      attachTo,
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

  it('navigates back to the member show page', async () => {
    const w = await mountMemberGallery(document.body)
    clickButton('Zurück')
    await flushPromises()
    expect(currentRouter.currentRoute.value.name).toBe('standesdb-member-show')
    w.unmount()
  })

  it('hides upload/edit/delete for a non-admin viewing another member', async () => {
    mockPermissions = []
    // mockUserId (99) differs from the mocked gallery owner id (1) - neither
    // admin nor self, the case this test guards against.
    const w = await mountMemberGallery()
    expect(w.text()).not.toContain('Neues Bild hochladen')
    expect(w.text()).not.toContain('Bearbeiten')
    expect(w.text()).not.toContain('Löschen')
  })

  it('shows upload/edit/delete for the resource owner even without admin permission', async () => {
    mockPermissions = []
    mockUserId = 1 // matches the mocked gallery owner id
    const w = await mountMemberGallery()
    expect(w.text()).toContain('Neues Bild hochladen')
    expect(w.text()).toContain('Bearbeiten')
    expect(w.text()).toContain('Löschen')
  })

  it('grants no self-service management on a contact gallery, even with a matching id', async () => {
    mockPermissions = []
    mockUserId = 1 // numerically matches the mocked contact id, but contacts have no self-service concept
    const w = await mountContactGallery()
    expect(w.text()).not.toContain('Neues Bild hochladen')
  })

  it('uses the self-service upload endpoint for the owner, not the admin one', async () => {
    mockPermissions = []
    mockUserId = 1
    const w = await mountMemberGallery(document.body)
    const input = w.find('.upload-file-input').element as HTMLInputElement
    setInputFiles(input, [makeFile('pic.jpg', 1000)])
    input.dispatchEvent(new Event('change'))
    await flushPromises()

    clickButton('Hochladen')
    await flushPromises()

    expect(mockUploadOwnImage).toHaveBeenCalledWith(expect.any(File), null)
    expect(mockUploadImage).not.toHaveBeenCalled()
    w.unmount()
  })

  it('uses the self-service update endpoint for the owner, not the admin one', async () => {
    mockPermissions = []
    mockUserId = 1
    const w = await mountMemberGallery(document.body)
    clickButton('Bearbeiten')
    await flushPromises()
    clickButton('Speichern')
    await flushPromises()

    expect(mockUpdateOwnImage).toHaveBeenCalledWith('image-uuid-1', {
      description: 'Profilbild',
      default: true,
    })
    expect(mockUpdateImage).not.toHaveBeenCalled()
    w.unmount()
  })

  it('uses the self-service delete endpoint for the owner, not the admin one', async () => {
    mockPermissions = []
    mockUserId = 1
    const w = await mountMemberGallery(document.body)
    clickButton('Löschen')
    await flushPromises()
    clickDialogButton('Löschen')
    await flushPromises()

    expect(mockDeleteOwnImage).toHaveBeenCalledWith('image-uuid-1')
    expect(mockDeleteImage).not.toHaveBeenCalled()
    w.unmount()
  })

  it('uses the self-service endpoint even for an admin who is also the owner', async () => {
    mockPermissions = ['standesdbVbwAdmin']
    mockUserId = 1
    const w = await mountMemberGallery(document.body)
    const input = w.find('.upload-file-input').element as HTMLInputElement
    setInputFiles(input, [makeFile('pic.jpg', 1000)])
    input.dispatchEvent(new Event('change'))
    await flushPromises()
    clickButton('Hochladen')
    await flushPromises()

    expect(mockUploadOwnImage).toHaveBeenCalled()
    expect(mockUploadImage).not.toHaveBeenCalled()
    w.unmount()
  })

  it('refreshes the auth store user after a self-service upload, so the navbar avatar updates', async () => {
    mockPermissions = []
    mockUserId = 1
    const w = await mountMemberGallery(document.body)
    const input = w.find('.upload-file-input').element as HTMLInputElement
    setInputFiles(input, [makeFile('pic.jpg', 1000)])
    input.dispatchEvent(new Event('change'))
    await flushPromises()
    clickButton('Hochladen')
    await flushPromises()

    expect(mockFetchUser).toHaveBeenCalled()
    w.unmount()
  })

  it("does not refresh the auth store user for an admin editing someone else's gallery", async () => {
    const w = await mountMemberGallery(document.body)
    clickButton('Bearbeiten')
    await flushPromises()
    clickButton('Speichern')
    await flushPromises()

    expect(mockFetchUser).not.toHaveBeenCalled()
    w.unmount()
  })

  it('loads via the dedicated self-service read endpoint, not the id-based one', async () => {
    mockUserId = 42
    await mountOwnGallery()
    expect(mockGetOwnImages).toHaveBeenCalled()
    expect(mockGetMemberImages).not.toHaveBeenCalled()
  })

  it('resolves the owner id from the auth store on the dedicated self-service route', async () => {
    mockPermissions = []
    mockUserId = 42
    const w = await mountOwnGallery()
    // ownerId (= authStore.user.id) feeds isSelf, which alone (no admin
    // permission) must already unlock management actions.
    expect(w.text()).toContain('Neues Bild hochladen')
  })

  it('hides the back button on the dedicated self-service route', async () => {
    const w = await mountOwnGallery()
    expect(w.text()).not.toContain('Zurück')
  })

  it('shows upload/edit/delete on the dedicated self-service route without admin permission', async () => {
    mockPermissions = []
    mockUserId = 1
    const w = await mountOwnGallery()
    expect(w.text()).toContain('Neues Bild hochladen')
  })

  it('shows upload section for a contact admin', async () => {
    const w = await mountContactGallery()
    expect(w.text()).toContain('Neues Bild hochladen')
  })

  it('shows the empty state for a contact with no images', async () => {
    const w = await mountContactGallery()
    expect(w.text()).toContain('Keine Profilbilder vorhanden.')
  })

  it('redirects to not-found on a 404 while loading', async () => {
    mockGetMemberImages.mockRejectedValue({ response: { status: 404 } })
    await mountMemberGallery()
    expect(currentRouter.currentRoute.value.name).toBe('not-found')
  })

  it('redirects to not-found on a 403 while loading', async () => {
    mockGetMemberImages.mockRejectedValue({ response: { status: 403 } })
    await mountMemberGallery()
    expect(currentRouter.currentRoute.value.name).toBe('not-found')
  })

  it('rejects a file with a disallowed type', async () => {
    const w = await mountMemberGallery(document.body)
    const input = w.find('.upload-file-input').element as HTMLInputElement
    setInputFiles(input, [makeFile('doc.pdf', 1000, 'application/pdf')])
    input.dispatchEvent(new Event('change'))
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Nur JPEG- und PNG-Dateien erlaubt.' }),
    )
    expect(input.value).toBe('')
    w.unmount()
  })

  it('rejects a file that is too large', async () => {
    const w = await mountMemberGallery(document.body)
    const input = w.find('.upload-file-input').element as HTMLInputElement
    setInputFiles(input, [makeFile('big.jpg', 6 * 1024 * 1024)])
    input.dispatchEvent(new Event('change'))
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Datei zu groß (max. 5 MB).' }),
    )
    w.unmount()
  })

  it('clears the displayed filename when a valid selection is followed by a rejected one', async () => {
    const w = await mountMemberGallery(document.body)
    const input = w.find('.upload-file-input').element as HTMLInputElement
    setInputFiles(input, [makeFile('good.jpg', 1000)])
    input.dispatchEvent(new Event('change'))
    await flushPromises()
    expect(w.text()).toContain('good.jpg')

    setInputFiles(input, [makeFile('doc.pdf', 1000, 'application/pdf')])
    input.dispatchEvent(new Event('change'))
    await flushPromises()

    expect(w.text()).not.toContain('good.jpg')
    expect(w.text()).toContain('Keine Datei ausgewählt')
    w.unmount()
  })

  it('uploads a valid file and reloads the gallery', async () => {
    const w = await mountMemberGallery(document.body)
    const input = w.find('.upload-file-input').element as HTMLInputElement
    setInputFiles(input, [makeFile('pic.jpg', 1000)])
    input.dispatchEvent(new Event('change'))
    await flushPromises()

    clickButton('Hochladen')
    await flushPromises()

    expect(mockUploadImage).toHaveBeenCalledWith('member', 1, expect.any(File), null)
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Gespeichert' }),
    )
    expect(mockGetMemberImages).toHaveBeenCalledTimes(2)
    w.unmount()
  })

  it('shows an error toast when the upload fails', async () => {
    mockUploadImage.mockRejectedValue({ response: { data: { detail: 'Serverfehler' } } })
    const w = await mountMemberGallery(document.body)
    const input = w.find('.upload-file-input').element as HTMLInputElement
    setInputFiles(input, [makeFile('pic.jpg', 1000)])
    input.dispatchEvent(new Event('change'))
    await flushPromises()

    clickButton('Hochladen')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Serverfehler' }),
    )
    w.unmount()
  })

  it('opens the edit dialog with prefilled values and saves', async () => {
    const w = await mountMemberGallery(document.body)
    clickButton('Bearbeiten')
    await flushPromises()

    const descInput = document.querySelector<HTMLInputElement>('.dialog-fields input[type=text]')
    expect(descInput?.value).toBe('Profilbild')

    clickButton('Speichern')
    await flushPromises()

    expect(mockUpdateImage).toHaveBeenCalledWith('member', 1, 'image-uuid-1', {
      description: 'Profilbild',
      default: true,
    })
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', detail: 'Änderungen gespeichert.' }),
    )
    w.unmount()
  })

  it('closes the edit dialog on cancel without saving', async () => {
    const w = await mountMemberGallery(document.body)
    clickButton('Bearbeiten')
    await flushPromises()

    clickButton('Abbrechen')
    await flushPromises()

    expect(mockUpdateImage).not.toHaveBeenCalled()
    w.unmount()
  })

  it('shows an error toast when saving the edit fails', async () => {
    mockUpdateImage.mockRejectedValue({ response: { data: { detail: 'Ungültig' } } })
    const w = await mountMemberGallery(document.body)
    clickButton('Bearbeiten')
    await flushPromises()

    clickButton('Speichern')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Ungültig' }),
    )
    w.unmount()
  })

  it('deletes an image after confirmation', async () => {
    const w = await mountMemberGallery(document.body)
    clickButton('Löschen')
    await flushPromises()

    clickDialogButton('Löschen')
    await flushPromises()

    expect(mockDeleteImage).toHaveBeenCalledWith('member', 1, 'image-uuid-1')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', detail: 'Profilbild gelöscht.' }),
    )
    w.unmount()
  })

  it('shows an error toast when deleting fails', async () => {
    mockDeleteImage.mockRejectedValue({ response: { data: { detail: 'Fehlgeschlagen' } } })
    const w = await mountMemberGallery(document.body)
    clickButton('Löschen')
    await flushPromises()
    clickDialogButton('Löschen')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Fehlgeschlagen' }),
    )
    w.unmount()
  })

  it('downloads an image via a generated link', async () => {
    mockGetImageUrl.mockResolvedValue({ data: { url: 'https://cdn.test/img1.jpg' } })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const w = await mountMemberGallery(document.body)

    clickButton('Download')
    await flushPromises()

    expect(mockGetImageUrl).toHaveBeenCalledWith('member', 1, 'image-uuid-1')
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
    w.unmount()
  })

  it('silently ignores a failed download', async () => {
    mockGetImageUrl.mockRejectedValue(new Error('boom'))
    const w = await mountMemberGallery(document.body)

    await expect(async () => {
      clickButton('Download')
      await flushPromises()
    }).not.toThrow()
    w.unmount()
  })
})
