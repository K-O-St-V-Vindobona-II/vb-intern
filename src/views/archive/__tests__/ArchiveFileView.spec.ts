import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ArchiveFileView from '../ArchiveFileView.vue'
import PrimeVue from 'primevue/config'
import type { FileDetail } from '@/types/archive'

function buildFile(overrides: Partial<FileDetail> = {}): FileDetail {
  return {
    type: 'file',
    id: 1,
    archive_dir_id: 5,
    name: 'Bericht',
    extension: 'pdf',
    description: 'Jahresbericht',
    size: 2048,
    is_image: false,
    mime_type: 'application/pdf',
    path: [],
    active_version: null,
    comments: [],
    trashed_comments: [],
    created_at: '2026-06-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  }
}

const mockGetFileDetail = vi.fn()
const mockUpdateFile = vi.fn()
vi.mock('@/services/archiveService', () => ({
  default: {
    getFileDetail: (...args: unknown[]) => mockGetFileDetail(...args),
    updateFile: (...args: unknown[]) => mockUpdateFile(...args),
  },
}))

const mockTriggerDownload = vi.fn()
vi.mock('@/composables/useArchiveDownload', () => ({
  useArchiveDownload: () => ({ triggerDownload: mockTriggerDownload }),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockAuthStore: { user: { permissions: string[] } | null } = {
  user: { permissions: [] },
}
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/archive/files/:id', name: 'archive-file', component: ArchiveFileView },
    { path: '/archive/dirs/:id', name: 'archive-dir', component: { template: '<div />' } },
    { path: '/archive', name: 'archive-root', component: { template: '<div />' } },
    { path: '/not-found', name: 'not-found', component: { template: '<div />' } },
  ],
})

const stubs = { DirPath: true, FileIcon: true, FileComments: true }

let activeWrapper: VueWrapper | null = null

async function mountAt(path: string) {
  await router.push(path)
  await router.isReady()
  const wrapper = mount(ArchiveFileView, {
    global: { plugins: [PrimeVue, router], stubs },
    attachTo: document.body,
  })
  activeWrapper = wrapper
  return wrapper
}

describe('ArchiveFileView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user = { permissions: [] }
    mockGetFileDetail.mockResolvedValue({ data: buildFile() })
    mockUpdateFile.mockResolvedValue({})
  })

  afterEach(() => {
    activeWrapper?.unmount()
    activeWrapper = null
  })

  it('loads the file by id and shows its name and extension', async () => {
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()

    expect(mockGetFileDetail).toHaveBeenCalledWith(1)
    expect(wrapper.text()).toContain('Bericht.pdf')
  })

  it('redirects to not-found on a 404', async () => {
    mockGetFileDetail.mockRejectedValueOnce({ response: { status: 404 } })
    await mountAt('/archive/files/999')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('redirects to not-found on a 403', async () => {
    mockGetFileDetail.mockRejectedValueOnce({ response: { status: 403 } })
    await mountAt('/archive/files/1')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('triggers a download with the file name and extension when the card is clicked', async () => {
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()

    await wrapper.find('.download-link').trigger('click')

    expect(mockTriggerDownload).toHaveBeenCalledWith(1, 'Bericht.pdf')
  })

  it('does not show the path row when the file has no path entries', async () => {
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()
    expect(wrapper.find('.file-path-row').exists()).toBe(false)
  })

  it('shows the path row when the file has path entries', async () => {
    mockGetFileDetail.mockResolvedValue({ data: buildFile({ path: [{ id: 5, name: 'Fotos' }] }) })
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()
    expect(wrapper.find('.file-path-row').exists()).toBe(true)
  })

  it('shows the creator only when an active version exists', async () => {
    mockGetFileDetail.mockResolvedValue({
      data: buildFile({
        active_version: {
          id: 1,
          name: 'Bericht',
          description: null,
          extension: 'pdf',
          mime_type: 'application/pdf',
          size: 2048,
          is_image: false,
          created_by: 'Max Mustermann',
          created_at: '2026-06-01T00:00:00Z',
        },
      }),
    })
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()
    expect(wrapper.text()).toContain('Erstellt von')
    expect(wrapper.text()).toContain('Max Mustermann')
  })

  it('does not show an edit button for non-admins', async () => {
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()
    expect(wrapper.find('.info-row button').exists()).toBe(false)
  })

  it('opens the edit dialog pre-filled with the current description for admins', async () => {
    mockAuthStore.user = { permissions: ['archiveAdmin'] }
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()

    await wrapper.find('.info-row button').trigger('click')
    await flushPromises()

    // Dialog content is teleported to document.body, outside the wrapper's tree.
    const input = document.querySelector('input') as HTMLInputElement
    expect(input.value).toBe('Jahresbericht')
  })

  it('saves the edited description and reloads the file', async () => {
    mockAuthStore.user = { permissions: ['archiveAdmin'] }
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()

    await wrapper.find('.info-row button').trigger('click')
    await flushPromises()

    const input = document.querySelector('input') as HTMLInputElement
    input.value = 'Neue Beschreibung'
    input.dispatchEvent(new Event('input'))
    await flushPromises()

    const saveBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Speichern'),
    )!
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockUpdateFile).toHaveBeenCalledWith(1, { description: 'Neue Beschreibung' })
    expect(mockGetFileDetail).toHaveBeenCalledTimes(2)
  })

  it('shows an error toast when saving the description fails', async () => {
    mockUpdateFile.mockRejectedValueOnce(new Error('failed'))
    mockAuthStore.user = { permissions: ['archiveAdmin'] }
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()

    await wrapper.find('.info-row button').trigger('click')
    await flushPromises()
    const saveBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Speichern'),
    )!
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('navigates to the parent directory when going back', async () => {
    mockGetFileDetail.mockResolvedValue({ data: buildFile({ archive_dir_id: 7 }) })
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()

    const backBtn = wrapper.findAll('button').find((b) => b.text().includes('Zum Verzeichnis'))!
    await backBtn.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('archive-dir')
    expect(router.currentRoute.value.params.id).toBe('7')
  })

  it('navigates to the archive root when the file has no parent directory', async () => {
    mockGetFileDetail.mockResolvedValue({ data: buildFile({ archive_dir_id: 0 }) })
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()

    const backBtn = wrapper.findAll('button').find((b) => b.text().includes('Zum Verzeichnis'))!
    await backBtn.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('archive-root')
  })
})
