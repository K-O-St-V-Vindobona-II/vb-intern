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
    id: 1,
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
})
