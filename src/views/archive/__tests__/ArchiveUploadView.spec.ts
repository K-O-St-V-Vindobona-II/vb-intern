import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ArchiveUploadView from '../ArchiveUploadView.vue'
import PrimeVue from 'primevue/config'
import type { UploadConfig, FileShort } from '@/types/archive'

function buildConfig(overrides: Partial<UploadConfig> = {}): UploadConfig {
  return {
    extensions: ['jpg', 'pdf'],
    minfilesize: 1, // KB
    maxfilesize: 5120, // KB (5 MB)
    descminlength: 5,
    descmaxlength: 100,
    ...overrides,
  }
}

function buildUnfiled(overrides: Partial<FileShort> = {}): FileShort {
  return {
    type: 'file',
    id: '1',
    name: 'Unsortiert',
    extension: 'pdf',
    description: null,
    size: 2048,
    is_image: false,
    mime_type: 'application/pdf',
    created_at: '2026-06-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  }
}

function makeFile(name: string, sizeBytes: number): File {
  const file = new File([new Uint8Array(sizeBytes)], name)
  return file
}

function setInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true })
}

const mockGetUploadConfig = vi.fn()
const mockGetUnfiledUploads = vi.fn()
const mockUploadFile = vi.fn()
vi.mock('@/services/archiveService', () => ({
  default: {
    getUploadConfig: (...args: unknown[]) => mockGetUploadConfig(...args),
    getUnfiledUploads: (...args: unknown[]) => mockGetUnfiledUploads(...args),
    uploadFile: (...args: unknown[]) => mockUploadFile(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mountOpts = { global: { plugins: [PrimeVue] } }

async function mountView() {
  const wrapper = mount(ArchiveUploadView, mountOpts)
  await flushPromises()
  return wrapper
}

describe('ArchiveUploadView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUploadConfig.mockResolvedValue({ data: buildConfig() })
    mockGetUnfiledUploads.mockResolvedValue({ data: { files: [] } })
    mockUploadFile.mockResolvedValue({})
  })

  it('loads the upload config and unfiled uploads on mount', async () => {
    mockGetUnfiledUploads.mockResolvedValue({ data: { files: [buildUnfiled({ name: 'Foto' })] } })
    const wrapper = await mountView()

    expect(mockGetUploadConfig).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Erlaubte Formate: jpg, pdf')
    expect(wrapper.text()).toContain('Meine unsortierten Uploads (1)')
    expect(wrapper.text()).toContain('Foto.pdf')
  })

  it('does not show the unfiled section when there are no unfiled uploads', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('.unfiled-card').exists()).toBe(false)
  })

  it('rejects a file without an extension', async () => {
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    setInputFiles(input, [makeFile('noextension', 2048)])
    await wrapper.find('input[type="file"]').trigger('change')

    expect(wrapper.text()).toContain('Keine Dateiendung.')
  })

  it('rejects a file with a disallowed extension', async () => {
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    setInputFiles(input, [makeFile('archive.exe', 2048)])
    await wrapper.find('input[type="file"]').trigger('change')

    expect(wrapper.text()).toContain('Format ".exe" nicht erlaubt.')
  })

  it('rejects a file that is too small', async () => {
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    setInputFiles(input, [makeFile('tiny.jpg', 100)]) // < 1 KB minimum
    await wrapper.find('input[type="file"]').trigger('change')

    expect(wrapper.text()).toContain('Zu klein (min. 1 KB).')
  })

  it('rejects a file that is too large', async () => {
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    setInputFiles(input, [makeFile('huge.jpg', 6 * 1024 * 1024)]) // > 5 MB maximum
    await wrapper.find('input[type="file"]').trigger('change')

    expect(wrapper.text()).toContain('Zu groß (max. 5 MB).')
  })

  it('accepts a valid file and shows the upload form', async () => {
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    setInputFiles(input, [makeFile('foto.jpg', 2048)])
    await wrapper.find('input[type="file"]').trigger('change')

    expect(wrapper.find('.file-item-invalid').exists()).toBe(false)
    expect(wrapper.find('.upload-form').exists()).toBe(true)
    expect(wrapper.text()).toContain('foto.jpg')
  })

  it('does not add the same file (name+size) twice', async () => {
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    setInputFiles(input, [makeFile('foto.jpg', 2048)])
    await wrapper.find('input[type="file"]').trigger('change')
    setInputFiles(input, [makeFile('foto.jpg', 2048)])
    await wrapper.find('input[type="file"]').trigger('change')

    expect(wrapper.findAll('.file-item')).toHaveLength(1)
  })

  it('shows a summary when both valid and invalid files are selected', async () => {
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    setInputFiles(input, [makeFile('ok.jpg', 2048), makeFile('bad.exe', 2048)])
    await wrapper.find('input[type="file"]').trigger('change')

    expect(wrapper.text()).toContain('1 Datei bereit, 1 wird übersprungen')
  })

  it('removes a file from the selection', async () => {
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    setInputFiles(input, [makeFile('foto.jpg', 2048)])
    await wrapper.find('input[type="file"]').trigger('change')
    expect(wrapper.findAll('.file-item')).toHaveLength(1)

    await wrapper.find('.file-remove').trigger('click')

    expect(wrapper.findAll('.file-item')).toHaveLength(0)
    expect(wrapper.find('.upload-form').exists()).toBe(false)
  })

  it('disables the upload button while the description is too short', async () => {
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    setInputFiles(input, [makeFile('foto.jpg', 2048)])
    await wrapper.find('input[type="file"]').trigger('change')

    const uploadBtn = wrapper.find('.upload-btn')
    expect(uploadBtn.attributes('disabled')).toBeDefined()

    await wrapper.find('.desc-input').setValue('Lange genug')
    expect(wrapper.find('.upload-btn').attributes('disabled')).toBeUndefined()
  })

  it('shows a hint while the description is non-empty but still too short', async () => {
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    setInputFiles(input, [makeFile('foto.jpg', 2048)])
    await wrapper.find('input[type="file"]').trigger('change')

    await wrapper.find('.desc-input').setValue('ab')
    expect(wrapper.find('.desc-hint').exists()).toBe(true)
  })

  it('uploads all valid files, clears the form and shows a success toast', async () => {
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    setInputFiles(input, [makeFile('foto.jpg', 2048)])
    await wrapper.find('input[type="file"]').trigger('change')
    await wrapper.find('.desc-input').setValue('Lange genug')

    await wrapper.find('.upload-btn').trigger('click')
    await flushPromises()

    expect(mockUploadFile).toHaveBeenCalledWith(expect.any(File), 'Lange genug')
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
    expect(wrapper.find('.file-list-section').exists()).toBe(false)
    expect(mockGetUnfiledUploads).toHaveBeenCalledTimes(2) // once on mount, once after upload
  })

  it('shows a warning toast listing per-file errors on partial upload failure', async () => {
    mockUploadFile.mockRejectedValueOnce({ response: { data: { detail: 'Serverfehler' } } })
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    setInputFiles(input, [makeFile('a.jpg', 2048), makeFile('b.jpg', 2048)])
    await wrapper.find('input[type="file"]').trigger('change')
    await wrapper.find('.desc-input').setValue('Lange genug')

    await wrapper.find('.upload-btn').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn', summary: '1 von 2 hochgeladen' }),
    )
  })

  it('opens the native file picker when the drop zone is clicked', async () => {
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    // input.click() itself dispatches a bubbling click that re-enters the
    // drop-zone's own @click handler, so this can fire more than once -
    // only the fact that it opens the picker at all is under test here.
    const clickSpy = vi.spyOn(input, 'click')

    await wrapper.find('.drop-zone').trigger('click')

    expect(clickSpy).toHaveBeenCalled()
  })

  it('toggles the active drag style on dragover/dragleave and adds files on drop', async () => {
    const wrapper = await mountView()
    const dropZone = wrapper.find('.drop-zone')

    await dropZone.trigger('dragover')
    expect(wrapper.find('.drop-zone-active').exists()).toBe(true)

    await dropZone.trigger('dragleave')
    expect(wrapper.find('.drop-zone-active').exists()).toBe(false)

    await dropZone.trigger('drop', {
      dataTransfer: { files: [makeFile('drop.jpg', 2048)] },
    })

    expect(wrapper.text()).toContain('drop.jpg')
    expect(wrapper.find('.drop-zone-active').exists()).toBe(false)
  })

  const pick = async (wrapper: Awaited<ReturnType<typeof mountView>>, files: File[]) => {
    const input = wrapper.find('input[type="file"]')
    setInputFiles(input.element as HTMLInputElement, files)
    await input.trigger('change')
  }

  describe('configuration', () => {
    it('regression: shows a toast and a retry button when the upload configuration cannot be loaded', async () => {
      mockGetUploadConfig.mockRejectedValueOnce({ response: { data: { detail: 'Serverfehler' } } })
      const wrapper = await mountView()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'Serverfehler' }),
      )
      expect(wrapper.find('.drop-zone').exists()).toBe(false)
      expect(wrapper.text()).toContain('Die Upload-Konfiguration konnte nicht geladen werden.')

      await wrapper
        .findAll('button')
        .find((b) => b.text().includes('Erneut versuchen'))
        ?.trigger('click')
      await flushPromises()

      expect(wrapper.find('.drop-zone').exists()).toBe(true)
      expect(wrapper.text()).toContain('Erlaubte Formate: jpg, pdf')
    })

    it('regression: warns when the unsorted uploads cannot be loaded', async () => {
      mockGetUnfiledUploads.mockRejectedValueOnce({
        response: { data: { detail: 'Liste kaputt' } },
      })
      await mountView()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn', detail: 'Liste kaputt' }),
      )
    })
  })

  describe('description', () => {
    it('regression: blanks around the text do not count towards the minimum', async () => {
      const wrapper = await mountView()
      await pick(wrapper, [makeFile('foto.jpg', 2048)])

      await wrapper.find('.desc-input').setValue('  ab   ')

      expect(wrapper.find('.upload-btn').attributes('disabled')).toBeDefined()
      expect(wrapper.find('.desc-hint').exists()).toBe(true)
    })

    it('regression: sends the description without surrounding blanks', async () => {
      const wrapper = await mountView()
      await pick(wrapper, [makeFile('foto.jpg', 2048)])
      await wrapper.find('.desc-input').setValue('  Lange genug  ')

      await wrapper.find('.upload-btn').trigger('click')
      await flushPromises()

      expect(mockUploadFile).toHaveBeenCalledWith(expect.any(File), 'Lange genug')
    })

    it('labels the field', async () => {
      const wrapper = await mountView()
      await pick(wrapper, [makeFile('foto.jpg', 2048)])

      expect(wrapper.find('label[for="upload-description"]').exists()).toBe(true)
      expect(wrapper.find('input#upload-description').exists()).toBe(true)
    })
  })

  describe('while uploading', () => {
    const startSlowUpload = async () => {
      let finish!: (value: unknown) => void
      mockUploadFile.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
      const wrapper = await mountView()
      await pick(wrapper, [makeFile('first.jpg', 2048)])
      await wrapper.find('.desc-input').setValue('Lange genug')
      await wrapper.find('.upload-btn').trigger('click')
      return { wrapper, finish }
    }

    it('regression: files dropped during the upload are refused instead of being cleared unseen', async () => {
      const { wrapper, finish } = await startSlowUpload()

      await wrapper.find('.drop-zone').trigger('drop', {
        dataTransfer: { files: [makeFile('later.jpg', 2048)] },
      })

      expect(wrapper.text()).not.toContain('later.jpg')
      finish({})
      await flushPromises()
      expect(mockUploadFile).toHaveBeenCalledTimes(1)
    })

    it('regression: the remove buttons are disabled', async () => {
      const { wrapper, finish } = await startSlowUpload()

      expect(wrapper.find('.file-remove').attributes('disabled')).toBeDefined()
      await wrapper.find('.file-remove').trigger('click')
      expect(wrapper.findAll('.file-item')).toHaveLength(1)
      finish({})
      await flushPromises()
    })
  })

  describe('failures', () => {
    it('regression: the files that failed stay selected, with their description, for another try', async () => {
      mockUploadFile.mockRejectedValueOnce({ response: { data: { detail: 'Serverfehler' } } })
      const wrapper = await mountView()
      await pick(wrapper, [makeFile('a.jpg', 2048), makeFile('b.jpg', 2048)])
      await wrapper.find('.desc-input').setValue('Lange genug')

      await wrapper.find('.upload-btn').trigger('click')
      await flushPromises()

      expect(wrapper.findAll('.file-item')).toHaveLength(1)
      expect(wrapper.find('.file-name').text()).toBe('a.jpg')
      expect((wrapper.find('.desc-input').element as HTMLInputElement).value).toBe('Lange genug')
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warn',
          summary: '1 von 2 hochgeladen',
          detail: expect.stringContaining('bleiben zum erneuten Versuch ausgewählt'),
        }),
      )

      mockUploadFile.mockClear()
      await wrapper.find('.upload-btn').trigger('click')
      await flushPromises()
      expect(mockUploadFile).toHaveBeenCalledTimes(1)
      expect((mockUploadFile.mock.calls[0]![0] as File).name).toBe('a.jpg')
      expect(wrapper.find('.file-list-section').exists()).toBe(false)
    })

    it('clears the description when everything went through', async () => {
      const wrapper = await mountView()
      await pick(wrapper, [makeFile('a.jpg', 2048)])
      await wrapper.find('.desc-input').setValue('Lange genug')

      await wrapper.find('.upload-btn').trigger('click')
      await flushPromises()

      await pick(wrapper, [makeFile('b.jpg', 2048)])
      expect((wrapper.find('.desc-input').element as HTMLInputElement).value).toBe('')
    })

    it('skips an invalid file without counting it as a failure', async () => {
      const wrapper = await mountView()
      await pick(wrapper, [makeFile('a.jpg', 2048), makeFile('bad.exe', 2048)])
      await wrapper.find('.desc-input').setValue('Lange genug')

      await wrapper.find('.upload-btn').trigger('click')
      await flushPromises()

      expect(mockUploadFile).toHaveBeenCalledTimes(1)
      expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
    })
  })

  describe('keyboard and assistive technology', () => {
    it.each([
      ['Enter', 'Enter'],
      ['Space', ' '],
    ])('regression: %s on the drop zone opens the file picker', async (_label, key) => {
      const wrapper = await mountView()
      const clickSpy = vi.spyOn(
        wrapper.find('input[type="file"]').element as HTMLInputElement,
        'click',
      )

      await wrapper.find('.drop-zone').trigger('keydown', { key })

      expect(clickSpy).toHaveBeenCalledTimes(1)
    })

    it('regression: announces the drop zone as a button', async () => {
      const wrapper = await mountView()
      const zone = wrapper.find('.drop-zone')

      expect(zone.attributes('role')).toBe('button')
      expect(zone.attributes('tabindex')).toBe('0')
      expect(zone.attributes('aria-label')).toBe('Dateien zum Hochladen auswählen')
    })

    it('regression: the remove control is a named button', async () => {
      const wrapper = await mountView()
      await pick(wrapper, [makeFile('foto.jpg', 2048)])

      const remove = wrapper.find('.file-remove')
      expect(remove.element.tagName).toBe('BUTTON')
      expect(remove.attributes('aria-label')).toBe('foto.jpg aus der Auswahl entfernen')
    })

    it('opens the picker once for a click on the drop zone', async () => {
      const wrapper = await mountView()
      const clickSpy = vi.spyOn(
        wrapper.find('input[type="file"]').element as HTMLInputElement,
        'click',
      )

      await wrapper.find('.drop-zone').trigger('click')

      expect(clickSpy).toHaveBeenCalledTimes(1)
    })
  })
})
