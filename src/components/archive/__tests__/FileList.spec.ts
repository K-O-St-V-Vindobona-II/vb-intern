import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import FileList from '../FileList.vue'
import { useArchiveStore } from '@/stores/archive'
import PrimeVue from 'primevue/config'
import type { FileShort } from '@/types/archive'

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
    id: '1',
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
    global: { plugins: [PrimeVue], stubs: { RouterLink: RouterLinkStub } },
    attachTo: document.body,
  })
  activeWrapper = wrapper
  return wrapper
}

// The hover preview asks matchMedia whether the primary input can hover; the
// shared test setup stubs it with "no match", i.e. a device that can hover.
const sharedMatchMedia = window.matchMedia

function simulateTouchOnlyDevice() {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({ matches: query === '(hover: none)', media: query }) as MediaQueryList,
  )
}

describe('FileList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockLoadPresignedUrl.mockResolvedValue(null)
    sessionStorage.clear()
    mockRestoreFile.mockResolvedValue({})
    mockDeleteFile.mockResolvedValue({})
  })

  afterEach(() => {
    activeWrapper?.unmount()
    activeWrapper = null
    vi.useRealTimers()
    vi.stubGlobal('matchMedia', sharedMatchMedia)
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

  it('links the file name to its archive-file route', () => {
    const wrapper = mountFileList({ items: [buildFile({ id: '7' })], title: 'Einsicht' })
    expect(wrapper.findComponent(RouterLinkStub).props('to')).toEqual({
      name: 'archive-file',
      params: { id: '7' },
    })
  })

  it('still links to the file in trash mode, but hides the download button', () => {
    const wrapper = mountFileList({
      items: [buildFile({ id: '7', name: 'Bericht', extension: 'pdf' })],
      title: 'Papierkorb',
      trash: true,
    })
    expect(wrapper.find('.download-btn').exists()).toBe(false)
    expect(wrapper.findComponent(RouterLinkStub).props('to')).toEqual({
      name: 'archive-file',
      params: { id: '7' },
    })
  })

  it('triggers a download when the download button is clicked', async () => {
    const wrapper = mountFileList({
      items: [buildFile({ id: '3', name: 'Bericht', extension: 'pdf' })],
      title: 'Einsicht',
    })
    await wrapper.find('.download-btn').trigger('click')
    expect(mockTriggerDownload).toHaveBeenCalledWith('3', 'Bericht.pdf')
  })

  it('does not show selection checkboxes or the clipboard button for non-admins', () => {
    const wrapper = mountFileList({ items: [buildFile()], title: 'Einsicht' })
    expect(wrapper.findComponent({ name: 'Checkbox' }).exists()).toBe(false)
  })

  it('copies selected files to the clipboard for admins and clears the selection', async () => {
    const store = useArchiveStore()
    const wrapper = mountFileList({
      items: [buildFile({ id: '1' }), buildFile({ id: '2' })],
      title: 'Einsicht',
      admin: true,
    })

    const selectCells = wrapper.findAll('.select-cell')
    await selectCells[1]!.trigger('click')
    await wrapper.find('.list-header button').trigger('click')

    expect(store.clipboard).toEqual(['file:1'])
    expect(wrapper.findComponent({ name: 'Checkbox' }).props('modelValue')).toBe(false)
  })

  it('selects the file that is shown in the clicked row after the table was sorted by name', async () => {
    const store = useArchiveStore()
    const wrapper = mountFileList({
      items: [buildFile({ id: '1', name: 'Alpha' }), buildFile({ id: '2', name: 'Zulu' })],
      title: 'Einsicht',
      admin: true,
    })

    // First click sorts ascending, the second descending: "Zulu" is now the first row.
    const nameHeader = wrapper.find('th.p-datatable-sortable-column')
    await nameHeader.trigger('click')
    await nameHeader.trigger('click')
    expect(wrapper.findAll('.file-link')[0]!.text()).toContain('Zulu')

    // selectCells[0] is the header "select all" cell, [1] is the first displayed row.
    await wrapper.findAll('.select-cell')[1]!.trigger('click')
    await wrapper.find('.list-header button').trigger('click')

    expect(store.clipboard).toEqual(['file:2'])
  })

  it('asks for confirmation before deleting a file and emits changed on accept', async () => {
    const wrapper = mountFileList({
      items: [buildFile({ id: '5' })],
      title: 'Einsicht',
      admin: true,
    })

    await wrapper.findAll('tbody button').at(-1)!.trigger('click')
    expect(mockConfirmRequire.mock.calls[0]![0].message).toBe('Datei wirklich löschen?')

    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockDeleteFile).toHaveBeenCalledWith('5')
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('restores a trashed file on confirmation', async () => {
    const wrapper = mountFileList({
      items: [buildFile({ id: '5' })],
      title: 'Papierkorb',
      admin: true,
      trash: true,
    })

    await wrapper.findAll('tbody button').at(-1)!.trigger('click')
    expect(mockConfirmRequire.mock.calls[0]![0].message).toBe('Datei wiederherstellen?')

    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockRestoreFile).toHaveBeenCalledWith('5')
  })

  it('shows an error toast when the delete/restore action fails', async () => {
    mockDeleteFile.mockRejectedValueOnce(new Error('failed'))
    const wrapper = mountFileList({
      items: [buildFile({ id: '5' })],
      title: 'Einsicht',
      admin: true,
    })

    await wrapper.findAll('tbody button').at(-1)!.trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('emits a debounced preview after hovering an image file', async () => {
    vi.useFakeTimers()
    const wrapper = mountFileList({
      items: [buildFile({ id: '9', is_image: true })],
      title: 'Einsicht',
    })

    await wrapper.find('.file-icon-wrap').trigger('mouseenter')
    // startPreview() always cancels any pending preview first, which emits
    // null immediately, before the new debounced preview fires.
    expect(wrapper.emitted('preview')).toEqual([[null]])

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.emitted('preview')).toEqual([[null], ['9']])
  })

  it('cancels the pending preview and emits null on mouseleave', async () => {
    vi.useFakeTimers()
    const wrapper = mountFileList({
      items: [buildFile({ id: '9', is_image: true })],
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
      items: [buildFile({ id: '9', is_image: false })],
      title: 'Einsicht',
    })

    await wrapper.find('.file-icon-wrap').trigger('mouseenter')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.emitted('preview')).toBeUndefined()
  })

  it('also starts a preview for trashed image files', async () => {
    vi.useFakeTimers()
    const wrapper = mountFileList({
      items: [buildFile({ id: '9', is_image: true })],
      title: 'Papierkorb',
      trash: true,
    })

    await wrapper.find('.file-icon-wrap').trigger('mouseenter')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.emitted('preview')).toEqual([[null], ['9']])
  })

  it('renders the download control as a real, named button', () => {
    const wrapper = mountFileList({
      items: [buildFile({ id: '3', name: 'Bericht', extension: 'pdf' })],
      title: 'Einsicht',
    })
    const button = wrapper.find('.download-btn')

    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-label')).toBe('Bericht.pdf herunterladen')
  })

  it('names the selection checkboxes and the icon-only admin buttons after their file', () => {
    const wrapper = mountFileList({
      items: [buildFile({ id: '1', name: 'Bericht', extension: 'pdf' })],
      title: 'Einsicht',
      admin: true,
    })
    const checkboxes = wrapper.findAllComponents({ name: 'Checkbox' })

    expect(checkboxes[0]!.find('input').attributes('aria-label')).toBe('Alle auswählen')
    expect(checkboxes[1]!.find('input').attributes('aria-label')).toBe('Bericht.pdf auswählen')
    expect(wrapper.find('.list-header button').attributes('aria-label')).toBe(
      'Ausgewählte Dateien in die Zwischenablage',
    )
    expect(wrapper.findAll('tbody button').at(-1)!.attributes('aria-label')).toBe(
      'Bericht.pdf löschen',
    )
  })

  it('keys the table rows by file id, so sorting moves rows instead of re-using them', () => {
    const wrapper = mountFileList({ items: [buildFile()], title: 'Einsicht' })
    expect(wrapper.findComponent({ name: 'DataTable' }).props('dataKey')).toBe('id')
  })

  it('shows the API detail when deleting or restoring is rejected', async () => {
    mockDeleteFile.mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), {
        response: { data: { detail: 'Datei ist gesperrt.' } },
      }),
    )
    const wrapper = mountFileList({
      items: [buildFile({ id: '5' })],
      title: 'Einsicht',
      admin: true,
    })

    await wrapper.findAll('tbody button').at(-1)!.trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Datei ist gesperrt.' }),
    )
  })

  it('uses a specific fallback text when the rejection carries no API detail', async () => {
    mockRestoreFile.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mountFileList({
      items: [buildFile({ id: '5' })],
      title: 'Papierkorb',
      admin: true,
      trash: true,
    })

    await wrapper.findAll('tbody button').at(-1)!.trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Datei konnte nicht wiederhergestellt werden.' }),
    )
  })

  it('uses a specific fallback text when deleting fails without an API detail', async () => {
    mockDeleteFile.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mountFileList({
      items: [buildFile({ id: '5' })],
      title: 'Einsicht',
      admin: true,
    })

    await wrapper.findAll('tbody button').at(-1)!.trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Datei konnte nicht gelöscht werden.' }),
    )
  })

  it('does not start a preview on a touch-only device', async () => {
    simulateTouchOnlyDevice()
    vi.useFakeTimers()
    const wrapper = mountFileList({
      items: [buildFile({ id: '9', is_image: true })],
      title: 'Einsicht',
    })

    await wrapper.find('.file-icon-wrap').trigger('mouseenter')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.emitted('preview')).toBeUndefined()
  })

  it('still starts a preview when a touch event handler exists but the primary input can hover', async () => {
    Object.defineProperty(window, 'ontouchstart', { value: null, configurable: true })
    vi.useFakeTimers()
    const wrapper = mountFileList({
      items: [buildFile({ id: '9', is_image: true })],
      title: 'Einsicht',
    })

    await wrapper.find('.file-icon-wrap').trigger('mouseenter')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.emitted('preview')).toEqual([[null], ['9']])
    delete (window as unknown as { ontouchstart?: unknown }).ontouchstart
  })

  it('renders file names and descriptions as plain text, never as markup', () => {
    const wrapper = mountFileList({
      items: [
        buildFile({
          name: '<img src=x onerror="window.__xss = 1">',
          extension: 'jpg',
          description: '<b>fett</b>',
        }),
      ],
      title: 'Einsicht',
    })

    expect(wrapper.find('.file-link').text()).toBe('<img src=x onerror="window.__xss = 1">.jpg')
    expect(wrapper.find('tbody img').exists()).toBe(false)
    expect(wrapper.find('tbody b').exists()).toBe(false)
    expect(wrapper.text()).toContain('<b>fett</b>')
  })
})
