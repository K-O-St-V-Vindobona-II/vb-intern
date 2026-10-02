import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import GalleryAdminView from '../GalleryAdminView.vue'
import PrimeVue from 'primevue/config'

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

const baseSettings = {
  about_video_heading: 'Erfahre mehr über den MKV',
  about_video_youtube_id: 'Sh51ebB2G8A',
  programm_calendar_id: 'abc@group.calendar.google.com',
  gallery_heading: 'Eindrücke',
}

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockListImages = vi.fn()
const mockUploadImage = vi.fn()
const mockUpdateImage = vi.fn()
const mockMoveImage = vi.fn()
const mockDeleteImage = vi.fn()
const mockGetSettings = vi.fn()
const mockUpdateSettings = vi.fn()

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

vi.mock('@/services/publicContentService', () => ({
  siteSettingsService: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
    updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
  },
}))

describe('GalleryAdminView', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    mockToastAdd.mockReset()
    mockListImages.mockReset().mockResolvedValue({ data: baseImages })
    mockUploadImage.mockReset().mockResolvedValue({ data: baseImages[0] })
    mockUpdateImage.mockReset().mockResolvedValue({ data: baseImages[0] })
    mockMoveImage.mockReset().mockResolvedValue({ data: { status: 'ok' } })
    mockDeleteImage.mockReset().mockResolvedValue({ data: { status: 'ok' } })
    mockGetSettings.mockReset().mockResolvedValue({ data: { ...baseSettings } })
    mockUpdateSettings.mockReset().mockResolvedValue({ data: { ...baseSettings } })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const mountView = async () => {
    wrapper = mount(GalleryAdminView, {
      global: { plugins: [PrimeVue] },
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

  it('renders the current section heading', async () => {
    const w = await mountView()
    expect((w.find('#gallery-heading').element as HTMLInputElement).value).toBe('Eindrücke')
  })

  it('saves an edited heading, preserving video/programm settings', async () => {
    const w = await mountView()
    await w.find('#gallery-heading').setValue('Bildergalerie')

    const saveButtons = w.findAll('button').filter((b) => b.text() === 'Speichern')
    await saveButtons[0]?.trigger('click')
    await flushPromises()

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      about_video_heading: 'Erfahre mehr über den MKV',
      youtube_url: 'https://www.youtube.com/watch?v=Sh51ebB2G8A',
      calendar_id: 'abc@group.calendar.google.com',
      gallery_heading: 'Bildergalerie',
    })
  })

  it('shows caption or fallback text', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Ostermesse')
    expect(w.text()).toContain('Kein Alt-Text hinterlegt')
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
    const upButtons = w.findAll('button[aria-label^="Nach oben verschieben"]')
    const downButtons = w.findAll('button[aria-label^="Nach unten verschieben"]')
    expect(upButtons[0]?.attributes('disabled')).toBeDefined()
    expect(downButtons[0]?.attributes('disabled')).toBeUndefined()
    expect(upButtons[1]?.attributes('disabled')).toBeUndefined()
    expect(downButtons[1]?.attributes('disabled')).toBeDefined()
  })

  it('moves an image up when the up-button is clicked', async () => {
    const w = await mountView()
    const upButtons = w.findAll('button[aria-label^="Nach oben verschieben"]')
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

  it('shows an error toast and a retry button when loading the gallery fails', async () => {
    mockListImages.mockRejectedValueOnce({ response: { data: { detail: 'Serverfehler' } } })
    const w = await mountView()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Serverfehler' }),
    )
    expect(w.text()).toContain('Galerie konnte nicht geladen werden.')
    expect(w.text()).not.toContain('Keine Bilder in der Galerie.')

    await w
      .findAll('button')
      .find((b) => b.text().includes('Erneut versuchen'))
      ?.trigger('click')
    await flushPromises()

    expect(w.text()).toContain('Ostermesse')
    expect(w.text()).not.toContain('Galerie konnte nicht geladen werden.')
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
    const upButtons = w.findAll('button[aria-label^="Nach oben verschieben"]')
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

    const saveButton = Array.from(document.querySelectorAll('.p-dialog button')).find(
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

    const saveButton = Array.from(document.querySelectorAll('.p-dialog button')).find(
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

  const chooseFile = async (w: VueWrapper, files: File[]) => {
    const input = w.find('input[type="file"]')
    setInputFiles(input.element as HTMLInputElement, files)
    await input.trigger('change')
    await flushPromises()
  }

  const uploadButton = (w: VueWrapper) =>
    w.findAll('button').find((b) => b.text().includes('Hochladen'))

  describe('upload selection', () => {
    it('regression: a rejected pick drops the file that was chosen before', async () => {
      const w = await mountView()
      await chooseFile(w, [new File(['x'], 'ok.jpg', { type: 'image/jpeg' })])
      expect(uploadButton(w)?.attributes('disabled')).toBeUndefined()

      await chooseFile(w, [new File(['x'], 'a.pdf', { type: 'application/pdf' })])

      expect(uploadButton(w)?.attributes('disabled')).toBeDefined()
      expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    })

    it('regression: a cancelled picker leaves nothing selected', async () => {
      const w = await mountView()
      await chooseFile(w, [new File(['x'], 'ok.jpg', { type: 'image/jpeg' })])

      await chooseFile(w, [])

      expect(uploadButton(w)?.attributes('disabled')).toBeDefined()
    })

    it('sends the caption without surrounding blanks, or none when it is blank', async () => {
      const w = await mountView()
      const file = new File(['x'], 'ok.jpg', { type: 'image/jpeg' })
      await chooseFile(w, [file])
      await w.find('.upload-caption').setValue('  Ostermesse 2026  ')

      await uploadButton(w)?.trigger('click')
      await flushPromises()
      expect(mockUploadImage).toHaveBeenLastCalledWith(file, 'Ostermesse 2026')

      await chooseFile(w, [file])
      await w.find('.upload-caption').setValue('   ')
      await uploadButton(w)?.trigger('click')
      await flushPromises()
      expect(mockUploadImage).toHaveBeenLastCalledWith(file, null)
    })

    it('clears the chosen file after a successful upload', async () => {
      const w = await mountView()
      await chooseFile(w, [new File(['x'], 'ok.jpg', { type: 'image/jpeg' })])

      await uploadButton(w)?.trigger('click')
      await flushPromises()

      expect(uploadButton(w)?.attributes('disabled')).toBeDefined()
    })

    it('labels the file field and the caption field', async () => {
      const w = await mountView()

      expect(w.find('label[for="upload-file"]').exists()).toBe(true)
      expect(w.find('input#upload-file').exists()).toBe(true)
      expect(w.find('.upload-caption').attributes('aria-label')).toBe('Alt-Text für das neue Bild')
    })
  })

  describe('changes keep the page mounted', () => {
    it('regression: moving an image does not rebuild the page', async () => {
      const w = await mountView()
      const headingInput = w.find('#gallery-heading').element

      await w.findAll('button[aria-label^="Nach oben verschieben"]')[1]?.trigger('click')
      await flushPromises()

      expect(mockListImages).toHaveBeenCalledTimes(2)
      expect(w.find('#gallery-heading').element).toBe(headingInput)
    })

    it('regression: an unsaved section title survives a change to the list', async () => {
      const w = await mountView()
      await w.find('#gallery-heading').setValue('Halb getippt')

      await w.findAll('button[aria-label^="Nach oben verschieben"]')[1]?.trigger('click')
      await flushPromises()

      expect((w.find('#gallery-heading').element as HTMLInputElement).value).toBe('Halb getippt')
    })

    it('regression: the move buttons wait for a pending move', async () => {
      let resolveMove!: (value: unknown) => void
      mockMoveImage.mockReturnValueOnce(new Promise((resolve) => (resolveMove = resolve)))
      const w = await mountView()

      await w.findAll('button[aria-label^="Nach oben verschieben"]')[1]?.trigger('click')

      const moveButtons = w.findAll('button[aria-label^="Nach "]')
      expect(moveButtons.length).toBe(4)
      expect(moveButtons.every((b) => b.attributes('disabled') !== undefined)).toBe(true)
      resolveMove({ data: { status: 'ok' } })
      await flushPromises()
      expect(
        w.findAll('button[aria-label^="Nach oben verschieben"]')[1]?.attributes('disabled'),
      ).toBeUndefined()
    })

    it('shows a toast, not an empty gallery, when the list cannot be read after a change', async () => {
      const w = await mountView()
      mockListImages.mockRejectedValueOnce({ response: { data: { detail: 'Liste kaputt' } } })

      await w.findAll('button[aria-label^="Nach oben verschieben"]')[1]?.trigger('click')
      await flushPromises()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'Liste kaputt' }),
      )
      expect(w.text()).toContain('Ostermesse')
    })

    it('names each row button after its image', async () => {
      const w = await mountView()

      expect(w.find('button[aria-label="Nach oben verschieben: Ostermesse"]').exists()).toBe(true)
      expect(w.find('button[aria-label="Löschen: Bild 2"]').exists()).toBe(true)
    })
  })

  describe('editing', () => {
    const openEditFor = async (w: VueWrapper, index: number) => {
      const editButtons = w.findAll('button').filter((b) => b.text().includes('Bearbeiten'))
      await editButtons[index]?.trigger('click')
      await flushPromises()
    }
    const clickDialogButton = async (label: string) => {
      Array.from(document.querySelectorAll('.p-dialog button'))
        .find((b) => b.textContent === label)
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushPromises()
    }

    it('regression: a cleared alt text is stored as none, not as an empty string', async () => {
      const w = await mountView()
      await openEditFor(w, 0)
      const input = document.querySelector<HTMLInputElement>('#edit-caption')!
      input.value = '   '
      input.dispatchEvent(new Event('input'))

      await clickDialogButton('Speichern')

      expect(mockUpdateImage).toHaveBeenCalledWith('img-1', { caption: null, is_published: true })
    })

    it('trims the alt text', async () => {
      const w = await mountView()
      await openEditFor(w, 0)
      const input = document.querySelector<HTMLInputElement>('#edit-caption')!
      input.value = '  Neu  '
      input.dispatchEvent(new Event('input'))

      await clickDialogButton('Speichern')

      expect(mockUpdateImage).toHaveBeenCalledWith('img-1', { caption: 'Neu', is_published: true })
    })

    it('keeps the stored none for an image that has no alt text', async () => {
      const w = await mountView()
      await openEditFor(w, 1)

      await clickDialogButton('Speichern')

      expect(mockUpdateImage).toHaveBeenCalledWith('img-2', { caption: null, is_published: false })
    })

    it('connects the labels of the edit dialog with their fields', async () => {
      const w = await mountView()
      await openEditFor(w, 0)

      expect(document.querySelector('label[for="edit-caption"]')).not.toBeNull()
      expect(document.querySelector('input#edit-caption')).not.toBeNull()
      expect(document.querySelector('label[for="edit-published"]')).not.toBeNull()
      expect(document.querySelector('input#edit-published')).not.toBeNull()
    })

    it('shows a toast when saving the change fails', async () => {
      mockUpdateImage.mockRejectedValue({ response: { data: { detail: 'Speichern kaputt' } } })
      const w = await mountView()
      await openEditFor(w, 0)

      await clickDialogButton('Speichern')

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'Speichern kaputt' }),
      )
    })
  })

  describe('section title', () => {
    it('saves the trimmed title on top of the settings stored right now', async () => {
      const w = await mountView()
      mockGetSettings.mockResolvedValue({
        data: {
          ...baseSettings,
          programm_calendar_id: 'changed-elsewhere@group.calendar.google.com',
        },
      })
      await w.find('#gallery-heading').setValue('  Bildergalerie  ')

      await w
        .findAll('button')
        .find((b) => b.text() === 'Speichern')
        ?.trigger('click')
      await flushPromises()

      expect(mockUpdateSettings).toHaveBeenCalledWith({
        about_video_heading: 'Erfahre mehr über den MKV',
        youtube_url: 'https://www.youtube.com/watch?v=Sh51ebB2G8A',
        calendar_id: 'changed-elsewhere@group.calendar.google.com',
        gallery_heading: 'Bildergalerie',
      })
    })

    it('does not offer to save a blank title', async () => {
      const w = await mountView()
      await w.find('#gallery-heading').setValue('   ')

      const save = w.findAll('button').find((b) => b.text() === 'Speichern')
      expect(save?.attributes('disabled')).toBeDefined()
    })

    it('shows a toast when saving the title fails', async () => {
      mockUpdateSettings.mockRejectedValue({ response: { data: { detail: 'Titel kaputt' } } })
      const w = await mountView()

      await w
        .findAll('button')
        .find((b) => b.text() === 'Speichern')
        ?.trigger('click')
      await flushPromises()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'Titel kaputt' }),
      )
    })
  })

  describe('messages, refreshed data and row names', () => {
    const chooseFile = async (w: VueWrapper, file: File) => {
      const input = w.find('input[type="file"]')
      setInputFiles(input.element as HTMLInputElement, [file])
      await input.trigger('change')
      await flushPromises()
      return input
    }

    it('tells the editor why a non-image file or an oversized file was refused', async () => {
      const w = await mountView()

      await chooseFile(w, new File(['x'], 'a.pdf', { type: 'application/pdf' }))
      expect(mockToastAdd).toHaveBeenLastCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Nur JPEG- und PNG-Dateien erlaubt.',
        }),
      )

      await chooseFile(
        w,
        new File([new Uint8Array(9 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' }),
      )
      expect(mockToastAdd).toHaveBeenLastCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'Datei zu groß (max. 8 MB).' }),
      )
    })

    it('empties the file field itself when a pick is refused', async () => {
      const w = await mountView()
      const input = w.find('input[type="file"]')
      const setValue = vi.fn()
      Object.defineProperty(input.element, 'value', {
        configurable: true,
        get: () => 'C:\\fakepath\\a.pdf',
        set: setValue,
      })

      await chooseFile(w, new File(['x'], 'a.pdf', { type: 'application/pdf' }))

      expect(setValue).toHaveBeenCalledWith('')
    })

    it.each([
      [
        'moving an image',
        async (w: VueWrapper) => {
          await w.findAll('button[aria-label^="Nach oben verschieben"]')[1]?.trigger('click')
        },
      ],
      [
        'deleting an image',
        async (w: VueWrapper) => {
          await w.findAll('button[aria-label^="Löschen"]')[0]?.trigger('click')
          await flushPromises()
          Array.from(document.querySelectorAll('.p-dialog button'))
            .find((b) => b.textContent === 'Löschen')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        },
      ],
      [
        'saving an edit',
        async (w: VueWrapper) => {
          await w.findAll('button[aria-label^="Bearbeiten"]')[0]?.trigger('click')
          await flushPromises()
          Array.from(document.querySelectorAll('.p-dialog button'))
            .find((b) => b.textContent === 'Speichern')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        },
      ],
    ])('shows the list as the API returns it after %s', async (_label, act) => {
      const w = await mountView()
      mockListImages.mockResolvedValue({
        data: [{ ...baseImages[0], caption: 'Nach der Änderung' }],
      })

      await act(w)
      await flushPromises()

      expect(mockListImages).toHaveBeenCalledTimes(2)
      expect(w.text()).toContain('Nach der Änderung')
      expect(w.text()).not.toContain('Ostermesse')
    })

    it('shows the title as the API stored it after saving', async () => {
      const w = await mountView()
      mockUpdateSettings.mockResolvedValue({
        data: { ...baseSettings, gallery_heading: 'Vom Server übernommen' },
      })
      await w.find('#gallery-heading').setValue('  Eigene Eingabe  ')

      await w
        .findAll('button')
        .filter((b) => b.text() === 'Speichern')[0]
        ?.trigger('click')
      await flushPromises()

      expect((w.find('#gallery-heading').element as HTMLInputElement).value).toBe(
        'Vom Server übernommen',
      )
    })

    it('names the edit and delete buttons after the image, or "Bild n" without alt text', async () => {
      const w = await mountView()

      expect(w.find('button[aria-label="Bearbeiten: Ostermesse"]').exists()).toBe(true)
      expect(w.find('button[aria-label="Löschen: Ostermesse"]').exists()).toBe(true)
      expect(w.find('button[aria-label="Bearbeiten: Bild 2"]').exists()).toBe(true)
      expect(w.find('button[aria-label="Löschen: Bild 2"]').exists()).toBe(true)
      expect(w.find('button[aria-label="Nach oben verschieben: Bild 2"]').exists()).toBe(true)
      expect(w.find('button[aria-label="Nach unten verschieben: Ostermesse"]').exists()).toBe(true)
    })
  })
})
