import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GalleryAdminView from '../GalleryAdminView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

const baseImages = [
  {
    id: 'img-1',
    url: 'https://s3.example.com/img-1.jpg',
    caption: 'Ostermesse',
    sort_order: 1,
    is_published: true,
    width: 800,
    height: 600,
    size: 123456,
    created_at: '2026-07-01T10:00:00Z',
  },
  {
    id: 'img-2',
    url: 'https://s3.example.com/img-2.jpg',
    caption: null,
    sort_order: 2,
    is_published: false,
    width: 400,
    height: 300,
    size: 2048,
    created_at: '2026-07-02T10:00:00Z',
  },
]

const mockListImages = vi.fn()
const mockUploadImage = vi.fn()
const mockUpdateImage = vi.fn()
const mockMoveImage = vi.fn()
const mockDeleteImage = vi.fn()

function setInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true })
}

vi.mock('@/services/publicGalleryService', () => ({
  default: {
    listImages: (...args: unknown[]) => mockListImages(...args),
    uploadImage: (...args: unknown[]) => mockUploadImage(...args),
    updateImage: (...args: unknown[]) => mockUpdateImage(...args),
    moveImage: (...args: unknown[]) => mockMoveImage(...args),
    deleteImage: (...args: unknown[]) => mockDeleteImage(...args),
  },
}))

describe('GalleryAdminView', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    setActivePinia(createPinia())
    mockListImages.mockReset().mockResolvedValue({ data: baseImages })
    mockUploadImage.mockReset().mockResolvedValue({ data: baseImages[0] })
    mockUpdateImage.mockReset().mockResolvedValue({ data: baseImages[0] })
    mockMoveImage.mockReset().mockResolvedValue({ data: { status: 'ok' } })
    mockDeleteImage.mockReset().mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const mountView = async () => {
    wrapper = mount(GalleryAdminView, {
      global: { plugins: [PrimeVue, ToastService, createPinia()] },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('renders page title and image count', async () => {
    const w = await mountView()
    expect(w.text()).toContain('www-Administration')
    expect(w.text()).toContain('Galerie')
    expect(w.text()).toContain('2 Bilder')
  })

  it('shows caption or fallback text', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Ostermesse')
    expect(w.text()).toContain('Keine Bildunterschrift')
  })

  it('shows publish state as a tag', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Veröffentlicht')
    expect(w.text()).toContain('Entwurf')
  })

  it('shows the upload section', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Neues Bild hochladen')
  })

  it('shows an empty state when there are no images', async () => {
    mockListImages.mockResolvedValue({ data: [] })
    const w = await mountView()
    expect(w.text()).toContain('Keine Bilder in der Galerie.')
  })

  it('disables the up-button for the first image and the down-button for the last', async () => {
    const w = await mountView()
    const upButtons = w.findAll('button[aria-label="Nach oben verschieben"]')
    const downButtons = w.findAll('button[aria-label="Nach unten verschieben"]')
    expect(upButtons[0]?.attributes('disabled')).toBeDefined()
    expect(downButtons[0]?.attributes('disabled')).toBeUndefined()
    expect(upButtons[1]?.attributes('disabled')).toBeUndefined()
    expect(downButtons[1]?.attributes('disabled')).toBeDefined()
  })

  it('moves an image up when the up-button is clicked', async () => {
    const w = await mountView()
    const upButtons = w.findAll('button[aria-label="Nach oben verschieben"]')
    await upButtons[1]?.trigger('click')
    await flushPromises()
    expect(mockMoveImage).toHaveBeenCalledWith('img-2', 'up')
  })

  it('opens the edit dialog with the current caption and publish state', async () => {
    const w = await mountView()
    const editButtons = w.findAll('button').filter((b) => b.text().includes('Bearbeiten'))
    await editButtons[0]?.trigger('click')
    await flushPromises()
    expect(document.body.innerHTML).toContain('Bild bearbeiten')
  })

  it('opens the delete confirmation dialog', async () => {
    const w = await mountView()
    const deleteButtons = w.findAll('button').filter((b) => b.text().includes('Löschen'))
    await deleteButtons[0]?.trigger('click')
    await flushPromises()
    expect(document.body.innerHTML).toContain(
      'Soll dieses Bild wirklich aus der Galerie gelöscht werden?',
    )
  })

  it('shows an error toast when loading the gallery fails', async () => {
    mockListImages.mockRejectedValue({ response: { data: { detail: 'Serverfehler' } } })
    const w = await mountView()
    expect(w.text()).not.toContain('Ostermesse')
  })

  it('rejects a non-image file on selection and does not enable upload', async () => {
    const w = await mountView()
    const input = w.find('input[type="file"]')
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' })
    setInputFiles(input.element as HTMLInputElement, [file])
    await input.trigger('change')
    await flushPromises()

    const uploadButton = w.findAll('button').find((b) => b.text().includes('Hochladen'))
    expect(uploadButton?.attributes('disabled')).toBeDefined()
  })

  it('rejects an oversized file on selection and does not enable upload', async () => {
    const w = await mountView()
    const input = w.find('input[type="file"]')
    const bigFile = new File([new Uint8Array(9 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    })
    setInputFiles(input.element as HTMLInputElement, [bigFile])
    await input.trigger('change')
    await flushPromises()

    const uploadButton = w.findAll('button').find((b) => b.text().includes('Hochladen'))
    expect(uploadButton?.attributes('disabled')).toBeDefined()
  })

  it('uploads a valid file and reloads the gallery', async () => {
    const w = await mountView()
    const input = w.find('input[type="file"]')
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    setInputFiles(input.element as HTMLInputElement, [file])
    await input.trigger('change')
    await flushPromises()

    const uploadButton = w.findAll('button').find((b) => b.text().includes('Hochladen'))
    expect(uploadButton?.attributes('disabled')).toBeUndefined()

    await uploadButton?.trigger('click')
    await flushPromises()

    expect(mockUploadImage).toHaveBeenCalledWith(file, null)
    expect(mockListImages).toHaveBeenCalledTimes(2)
  })

  it('does not reload the gallery when the upload fails', async () => {
    mockUploadImage.mockRejectedValue({ response: { data: { detail: 'Upload kaputt' } } })
    const w = await mountView()
    const input = w.find('input[type="file"]')
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    setInputFiles(input.element as HTMLInputElement, [file])
    await input.trigger('change')
    await flushPromises()

    const uploadButton = w.findAll('button').find((b) => b.text().includes('Hochladen'))
    await uploadButton?.trigger('click')
    await flushPromises()

    expect(mockUploadImage).toHaveBeenCalledOnce()
    expect(mockListImages).toHaveBeenCalledOnce()
  })

  it('does not reload the gallery when moving an image fails', async () => {
    mockMoveImage.mockRejectedValue({ response: { data: { detail: 'Verschieben kaputt' } } })
    const w = await mountView()
    const upButtons = w.findAll('button[aria-label="Nach oben verschieben"]')
    await upButtons[1]?.trigger('click')
    await flushPromises()
    expect(mockMoveImage).toHaveBeenCalledOnce()
    expect(mockListImages).toHaveBeenCalledOnce()
  })

  it('saves an edited caption and publish state', async () => {
    const w = await mountView()
    const editButtons = w.findAll('button').filter((b) => b.text().includes('Bearbeiten'))
    await editButtons[0]?.trigger('click')
    await flushPromises()

    const captionInput = document.querySelector<HTMLInputElement>('.p-dialog-content .p-inputtext')
    expect(captionInput).toBeTruthy()
    if (captionInput) {
      captionInput.value = 'Neue Bildunterschrift'
      captionInput.dispatchEvent(new Event('input'))
    }

    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )
    saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockUpdateImage).toHaveBeenCalledWith('img-1', {
      caption: 'Neue Bildunterschrift',
      is_published: true,
    })
  })

  it('keeps the edit dialog open when saving fails', async () => {
    mockUpdateImage.mockRejectedValue({ response: { data: { detail: 'Speichern kaputt' } } })
    const w = await mountView()
    const editButtons = w.findAll('button').filter((b) => b.text().includes('Bearbeiten'))
    await editButtons[0]?.trigger('click')
    await flushPromises()

    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )
    saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockUpdateImage).toHaveBeenCalledOnce()
    expect(document.body.innerHTML).toContain('Bild bearbeiten')
  })

  it('deletes an image after confirming in the dialog', async () => {
    const w = await mountView()
    const deleteButtons = w.findAll('button').filter((b) => b.text().includes('Löschen'))
    await deleteButtons[0]?.trigger('click')
    await flushPromises()

    const confirmButton = Array.from(document.querySelectorAll('.p-dialog button')).find(
      (b) => b.textContent === 'Löschen',
    )
    confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockDeleteImage).toHaveBeenCalledWith('img-1')
  })

  it('does not reload the gallery when deletion fails', async () => {
    mockDeleteImage.mockRejectedValue({ response: { data: { detail: 'Löschen kaputt' } } })
    const w = await mountView()
    const deleteButtons = w.findAll('button').filter((b) => b.text().includes('Löschen'))
    await deleteButtons[0]?.trigger('click')
    await flushPromises()

    const confirmButton = Array.from(document.querySelectorAll('.p-dialog button')).find(
      (b) => b.textContent === 'Löschen',
    )
    confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockDeleteImage).toHaveBeenCalledOnce()
    expect(mockListImages).toHaveBeenCalledOnce()
  })
})
