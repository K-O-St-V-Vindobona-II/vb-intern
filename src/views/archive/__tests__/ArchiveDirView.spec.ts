import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ArchiveDirView from '../ArchiveDirView.vue'
import { useArchiveStore } from '@/stores/archive'
import PrimeVue from 'primevue/config'
import type { DirDetail } from '@/types/archive'

function buildDir(overrides: Partial<DirDetail> = {}): DirDetail {
  return {
    type: 'dir',
    id: '1',
    name: 'Fotos',
    description: null,
    path: [],
    permissions: { effective: [], own: [], parent: [] },
    recursive_permissions: false,
    content: {
      subdirs: { insight: [], admin: [], trashed: [] },
      files: { insight: [], admin: [], trashed: [] },
    },
    sets: { orgs: [], states: [] },
    stats: null,
    created_at: null,
    updated_at: null,
    deleted_at: null,
    ...overrides,
  }
}

const mockGetDirRoot = vi.fn()
const mockGetDirDetail = vi.fn()
const mockSearchArchive = vi.fn()
vi.mock('@/services/archiveService', () => ({
  default: {
    getDirRoot: (...args: unknown[]) => mockGetDirRoot(...args),
    getDirDetail: (...args: unknown[]) => mockGetDirDetail(...args),
    searchArchive: (...args: unknown[]) => mockSearchArchive(...args),
  },
}))

const mockLoadPresignedUrl = vi.fn()
vi.mock('@/composables/useArchiveDownload', () => ({
  useArchiveDownload: () => ({ loadPresignedUrl: mockLoadPresignedUrl }),
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
    { path: '/archive', name: 'archive-root', component: ArchiveDirView },
    { path: '/archive/dirs/:id', name: 'archive-dir', component: ArchiveDirView },
    { path: '/archive/files/:id', name: 'archive-file', component: { template: '<div />' } },
    { path: '/not-found', name: 'not-found', component: { template: '<div />' } },
  ],
})

const stubs = {
  DirPath: true,
  DirList: true,
  FileList: true,
  DirGallery: true,
  DirEditor: true,
  PermissionViewer: true,
  ClipboardBar: true,
}

let activeWrapper: VueWrapper | null = null

async function mountAt(path: string) {
  await router.push(path)
  await router.isReady()
  setActivePinia(createPinia())
  const wrapper = mount(ArchiveDirView, {
    global: { plugins: [PrimeVue, router], stubs },
  })
  activeWrapper = wrapper
  return wrapper
}

describe('ArchiveDirView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user = { permissions: [] }
    mockGetDirRoot.mockResolvedValue({ data: buildDir({ id: null, name: 'Archiv' }) })
    mockGetDirDetail.mockResolvedValue({ data: buildDir({ id: '5', name: 'Fotos' }) })
    mockSearchArchive.mockResolvedValue({ data: [] })
  })

  afterEach(() => {
    // Without this, a previous test's still-mounted component keeps its
    // route watcher active, so a later router.push() makes it re-fetch too
    // — stealing mockRejectedValueOnce/mockResolvedValueOnce entries meant
    // for the new test's instance and causing order-dependent flakiness.
    activeWrapper?.unmount()
    activeWrapper = null
  })

  it('loads the archive root when there is no id param', async () => {
    const wrapper = await mountAt('/archive')
    await flushPromises()

    expect(mockGetDirRoot).toHaveBeenCalledOnce()
    expect(mockGetDirDetail).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Archiv')
  })

  it('loads a specific directory by id', async () => {
    await mountAt('/archive/dirs/5')
    await flushPromises()

    expect(mockGetDirDetail).toHaveBeenCalledWith('5')
  })

  it('shows archive-wide stats at the root, with the by-extension table collapsed by default', async () => {
    mockGetDirRoot.mockResolvedValue({
      data: buildDir({
        id: null,
        name: 'Archiv',
        stats: {
          file_count: 42,
          unique_object_count: 30,
          dir_count: 7,
          total_size: 2 * 1024 * 1024,
          by_extension: [{ extension: 'jpg', count: 20, size: 900000 }],
        },
      }),
    })
    const wrapper = await mountAt('/archive')
    await flushPromises()

    expect(wrapper.find('.archive-stats').exists()).toBe(true)
    expect(wrapper.text()).toContain('42')
    expect(wrapper.text()).toContain('30')
    expect(wrapper.text()).toContain('7')
    expect(wrapper.text()).toContain('2.0 MB')
    expect(wrapper.text()).not.toContain('jpg')

    await wrapper.find('.stats-toggle').trigger('click')

    expect(wrapper.text()).toContain('jpg')
  })

  it('does not show archive-wide stats for a real subdirectory', async () => {
    const wrapper = await mountAt('/archive/dirs/5')
    await flushPromises()

    expect(wrapper.find('.archive-stats').exists()).toBe(false)
    expect(wrapper.find('.stats-by-extension').exists()).toBe(false)
  })

  it('redirects to not-found on a 404', async () => {
    mockGetDirDetail.mockRejectedValueOnce({ response: { status: 404 } })
    await mountAt('/archive/dirs/999')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('redirects to not-found on a 403', async () => {
    mockGetDirDetail.mockRejectedValueOnce({ response: { status: 403 } })
    await mountAt('/archive/dirs/5')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('shows an error state with a retry button on a non-404/403 failure', async () => {
    mockGetDirDetail.mockRejectedValueOnce({ response: { status: 500 } })
    const wrapper = await mountAt('/archive/dirs/5')
    await flushPromises()

    expect(router.currentRoute.value.name).not.toBe('not-found')
    expect(wrapper.find('.archive-error').exists()).toBe(true)
    expect(wrapper.text()).toContain('Verzeichnis konnte nicht geladen werden.')
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))

    mockGetDirDetail.mockResolvedValueOnce({ data: buildDir({ id: '5', name: 'Fotos' }) })
    await wrapper.find('.archive-error button').trigger('click')
    await flushPromises()

    expect(wrapper.find('.archive-error').exists()).toBe(false)
    expect(wrapper.text()).toContain('Fotos')
  })

  it('uses the shared SearchField component, like the other searches in the app', async () => {
    const wrapper = await mountAt('/archive')
    await flushPromises()

    expect(wrapper.findComponent({ name: 'SearchField' }).exists()).toBe(true)
  })

  it('does not search for queries shorter than 2 characters', async () => {
    const wrapper = await mountAt('/archive')
    await flushPromises()

    const ac = wrapper.findComponent({ name: 'AutoComplete' })
    await ac.vm.$emit('complete', { query: 'a' })
    await flushPromises()

    expect(mockSearchArchive).not.toHaveBeenCalled()
  })

  it('searches once the query reaches the 2-character minimum (lower than the app default, since the archive has meaningful 2-letter abbreviations like "BC")', async () => {
    mockSearchArchive.mockResolvedValue({
      data: [{ type: 'dir', id: '9', name: 'BC-Protokolle', description: null, path: '/Archiv' }],
    })
    const wrapper = await mountAt('/archive')
    await flushPromises()

    const ac = wrapper.findComponent({ name: 'AutoComplete' })
    await ac.vm.$emit('complete', { query: 'BC' })
    await flushPromises()

    expect(mockSearchArchive).toHaveBeenCalledWith('BC')
  })

  it('searches and maps results to labeled suggestions', async () => {
    mockSearchArchive.mockResolvedValue({
      data: [{ type: 'dir', id: '9', name: 'Treffer', description: null, path: '/Archiv' }],
    })
    const wrapper = await mountAt('/archive')
    await flushPromises()

    const ac = wrapper.findComponent({ name: 'AutoComplete' })
    await ac.vm.$emit('complete', { query: 'Foto' })
    await flushPromises()

    expect(mockSearchArchive).toHaveBeenCalledWith('Foto')
    expect(ac.props('suggestions')).toEqual([
      { id: '9', type: 'dir', label: 'Verzeichnis: Treffer (/Archiv)' },
    ])
  })

  it('navigates to the result when a search result is selected', async () => {
    mockSearchArchive.mockResolvedValue({
      data: [{ type: 'file', id: '9', name: 'Treffer', description: null, path: '/Archiv' }],
    })
    const wrapper = await mountAt('/archive')
    await flushPromises()

    const ac = wrapper.findComponent({ name: 'AutoComplete' })
    await ac.vm.$emit('complete', { query: 'Foto' })
    await flushPromises()

    const suggestion = ac.props('suggestions')[0]
    await ac.vm.$emit('item-select', { value: suggestion })
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('archive-file')
    expect(router.currentRoute.value.params.id).toBe('9')
  })

  it('does not show the clipboard bar or admin section for non-admins', async () => {
    const wrapper = await mountAt('/archive')
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ClipboardBar' }).exists()).toBe(false)
    expect(wrapper.find('.admin-section').exists()).toBe(false)
  })

  it('shows the clipboard bar and admin toggle for archive admins', async () => {
    mockAuthStore.user = { permissions: ['archiveAdmin'] }
    const wrapper = await mountAt('/archive')
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ClipboardBar' }).exists()).toBe(true)
    expect(wrapper.find('.admin-toggle-row').exists()).toBe(true)
    expect(wrapper.find('.admin-panel').exists()).toBe(false)
  })

  it('toggles the admin panel open and closed', async () => {
    mockAuthStore.user = { permissions: ['archiveAdmin'] }
    const wrapper = await mountAt('/archive')
    await flushPromises()
    const store = useArchiveStore()

    await wrapper.find('.admin-toggle-row .admin-toggle').trigger('click')
    expect(store.showAdmin).toBe(true)
    expect(wrapper.find('.admin-panel').exists()).toBe(true)

    await wrapper.find('.admin-panel .admin-toggle').trigger('click')
    expect(store.showAdmin).toBe(false)
  })

  it('loads and clears the hover preview via the preview event', async () => {
    mockLoadPresignedUrl.mockResolvedValue('https://minio.test/preview.jpg')
    const wrapper = await mountAt('/archive')
    await flushPromises()

    const fileList = wrapper.findComponent({ name: 'FileList' })
    await fileList.vm.$emit('preview', 7)
    await flushPromises()

    expect(mockLoadPresignedUrl).toHaveBeenCalledWith(7, 'lg')
    expect(wrapper.find('.hover-preview').exists()).toBe(true)

    await fileList.vm.$emit('preview', null)
    await flushPromises()

    expect(wrapper.find('.hover-preview').exists()).toBe(false)
  })

  it('reloads the directory when a child component emits changed', async () => {
    const wrapper = await mountAt('/archive')
    await flushPromises()
    mockGetDirRoot.mockClear()

    await wrapper.findComponent({ name: 'FileList' }).vm.$emit('changed')
    await flushPromises()

    expect(mockGetDirRoot).toHaveBeenCalledOnce()
  })
})
