import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import FileList from '../FileList.vue'
import { useArchiveStore } from '@/stores/archive'
import PrimeVue from 'primevue/config'
import type { FileShort } from '@/types/archive'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockConfirmRequire = vi.fn()
vi.mock('primevue/useconfirm', () => ({
  useConfirm: vi.fn(() => ({ require: mockConfirmRequire })),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockTriggerDownload = vi.fn()
const mockLoadPresignedUrl = vi.fn().mockResolvedValue(null)
vi.mock('@/composables/useArchiveDownload', () => ({
  useArchiveDownload: () => ({
    triggerDownload: mockTriggerDownload,
    loadPresignedUrl: mockLoadPresignedUrl,
  }),
}))

const mockRestoreFile = vi.fn()
const mockDeleteFile = vi.fn()
vi.mock('@/services/archiveService', () => ({
  default: {
    restoreFile: (...args: unknown[]) => mockRestoreFile(...args),
    deleteFile: (...args: unknown[]) => mockDeleteFile(...args),
  },
}))

// FileList renders the real FileIcon child, which observes visibility for
// image thumbnails; jsdom has no IntersectionObserver, so stub a no-op.
class NoopIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
  takeRecords = vi.fn(() => [])
  root = null
  rootMargin = ''
  thresholds = []
}
vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver)

function buildFile(overrides: Partial<FileShort> = {}): FileShort {
  return {
    type: 'file',
    id: 1,
    name: 'Bericht',
    extension: 'pdf',
    description: 'Jahresbericht',
    size: 2048,
    is_image: false,
    mime_type: 'application/pdf',
    created_at: '2026-06-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  }
}

let activeWrapper: VueWrapper | null = null

function mountFileList(props: Record<string, unknown>) {
  const wrapper = mount(FileList, {
    props,
    global: { plugins: [PrimeVue] },
    attachTo: document.body,
  })
  activeWrapper = wrapper
  return wrapper
}

// jsdom defines `ontouchstart` as an own property of window (even though it's
// not a real touch device), which would make the component's touchDevice
// check always true and the hover-preview handler unreachable. Remove it for
// the duration of this suite to simulate a real desktop browser, and restore
// it afterwards so other test files aren't affected.
let ontouchstartDescriptor: PropertyDescriptor | undefined

describe('FileList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockLoadPresignedUrl.mockResolvedValue(null)
    sessionStorage.clear()
    mockRestoreFile.mockResolvedValue({})
    ontouchstartDescriptor = Object.getOwnPropertyDescriptor(window, 'ontouchstart')
    delete (window as unknown as { ontouchstart?: unknown }).ontouchstart
    mockDeleteFile.mockResolvedValue({})
  })

  afterEach(() => {
    activeWrapper?.unmount()
    activeWrapper = null
    vi.useRealTimers()
    if (ontouchstartDescriptor) {
      Object.defineProperty(window, 'ontouchstart', ontouchstartDescriptor)
    }
  })

  it('renders nothing when there are no items', () => {
    const wrapper = mountFileList({ items: [], title: 'Dateien' })
    expect(wrapper.find('.file-list').exists()).toBe(false)
  })

  it('shows the title with item count and the name, extension and size per file', () => {
    const wrapper = mountFileList({
      items: [buildFile({ name: 'Bericht', extension: 'pdf', size: 1024 })],
      title: 'Einsicht',
    })
    expect(wrapper.text()).toContain('Einsicht (1)')
    expect(wrapper.text()).toContain('Bericht.pdf')
    expect(wrapper.text()).toContain('(1 KB)')
  })

  it('navigates to the file when its name link is clicked', async () => {
    const wrapper = mountFileList({ items: [buildFile({ id: 7 })], title: 'Einsicht' })
    await wrapper.find('.file-link').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'archive-file', params: { id: 7 } })
  })

  it('renders a plain name without a link or download icon in trash mode', () => {
    const wrapper = mountFileList({
      items: [buildFile({ name: 'Bericht', extension: 'pdf' })],
      title: 'Papierkorb',
      trash: true,
    })
    expect(wrapper.find('.file-link').exists()).toBe(false)
    expect(wrapper.find('.download-icon').exists()).toBe(false)
    expect(wrapper.text()).toContain('Bericht.pdf')
  })

  it('triggers a download when the download icon is clicked', async () => {
    const wrapper = mountFileList({
      items: [buildFile({ id: 3, name: 'Bericht', extension: 'pdf' })],
      title: 'Einsicht',
    })
    await wrapper.find('.download-icon').trigger('click')
    expect(mockTriggerDownload).toHaveBeenCalledWith(3, 'Bericht.pdf')
  })

  it('does not show selection checkboxes or the clipboard button for non-admins', () => {
    const wrapper = mountFileList({ items: [buildFile()], title: 'Einsicht' })
    expect(wrapper.findComponent({ name: 'Checkbox' }).exists()).toBe(false)
  })

  it('copies selected files to the clipboard for admins and clears the selection', async () => {
    const store = useArchiveStore()
    const wrapper = mountFileList({
      items: [buildFile({ id: 1 }), buildFile({ id: 2 })],
      title: 'Einsicht',
      admin: true,
    })

    const selectCells = wrapper.findAll('.select-cell')
    await selectCells[1]!.trigger('click')
    await wrapper.find('.list-header button').trigger('click')

    expect(store.clipboard).toEqual(['file:1'])
    expect(wrapper.findComponent({ name: 'Checkbox' }).props('modelValue')).toBe(false)
  })

  it('asks for confirmation before deleting a file and emits changed on accept', async () => {
    const wrapper = mountFileList({ items: [buildFile({ id: 5 })], title: 'Einsicht', admin: true })

    await wrapper.find('tbody button').trigger('click')
    expect(mockConfirmRequire.mock.calls[0]![0].message).toBe('Datei wirklich löschen?')

    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockDeleteFile).toHaveBeenCalledWith(5)
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('restores a trashed file on confirmation', async () => {
    const wrapper = mountFileList({
      items: [buildFile({ id: 5 })],
      title: 'Papierkorb',
      admin: true,
      trash: true,
    })

    await wrapper.find('tbody button').trigger('click')
    expect(mockConfirmRequire.mock.calls[0]![0].message).toBe('Datei wiederherstellen?')

    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockRestoreFile).toHaveBeenCalledWith(5)
  })

  it('shows an error toast when the delete/restore action fails', async () => {
    mockDeleteFile.mockRejectedValueOnce(new Error('failed'))
    const wrapper = mountFileList({ items: [buildFile({ id: 5 })], title: 'Einsicht', admin: true })

    await wrapper.find('tbody button').trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('emits a debounced preview after hovering an image file', async () => {
    vi.useFakeTimers()
    const wrapper = mountFileList({
      items: [buildFile({ id: 9, is_image: true })],
      title: 'Einsicht',
    })

    await wrapper.find('.file-icon-wrap').trigger('mouseenter')
    // startPreview() always cancels any pending preview first, which emits
    // null immediately, before the new debounced preview fires.
    expect(wrapper.emitted('preview')).toEqual([[null]])

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.emitted('preview')).toEqual([[null], [9]])
  })

  it('cancels the pending preview and emits null on mouseleave', async () => {
    vi.useFakeTimers()
    const wrapper = mountFileList({
      items: [buildFile({ id: 9, is_image: true })],
      title: 'Einsicht',
    })

    await wrapper.find('.file-icon-wrap').trigger('mouseenter')
    await wrapper.find('.file-icon-wrap').trigger('mouseleave')
    vi.advanceTimersByTime(300)
    await flushPromises()

    // mouseenter's startPreview() emits null once before arming the timer,
    // mouseleave's cancelPreview() clears that timer and emits null again.
    expect(wrapper.emitted('preview')).toEqual([[null], [null]])
  })

  it('does not start a preview for non-image files', async () => {
    vi.useFakeTimers()
    const wrapper = mountFileList({
      items: [buildFile({ id: 9, is_image: false })],
      title: 'Einsicht',
    })

    await wrapper.find('.file-icon-wrap').trigger('mouseenter')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.emitted('preview')).toBeUndefined()
  })

  it('does not start a preview for trashed files', async () => {
    vi.useFakeTimers()
    const wrapper = mountFileList({
      items: [buildFile({ id: 9, is_image: true })],
      title: 'Papierkorb',
      trash: true,
    })

    await wrapper.find('.file-icon-wrap').trigger('mouseenter')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.emitted('preview')).toBeUndefined()
  })
})
