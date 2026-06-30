import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ArchiveDirView from '../ArchiveDirView.vue'
import { useArchiveStore } from '@/stores/archive'
import PrimeVue from 'primevue/config'
import type { DirDetail } from '@/types/archive'

function buildDir(overrides: Partial<DirDetail> = {}): DirDetail {
  return {
    type: 'dir',
    id: 1,
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

async function mountAt(path: string) {
  await router.push(path)
  await router.isReady()
  setActivePinia(createPinia())
  return mount(ArchiveDirView, {
    global: { plugins: [PrimeVue, router], stubs },
  })
}

describe('ArchiveDirView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user = { permissions: [] }
    mockGetDirRoot.mockResolvedValue({ data: buildDir({ id: 0, name: 'Archiv' }) })
    mockGetDirDetail.mockResolvedValue({ data: buildDir({ id: 5, name: 'Fotos' }) })
    mockSearchArchive.mockResolvedValue({ data: [] })
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

    expect(mockGetDirDetail).toHaveBeenCalledWith(5)
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

  it('does not search for queries shorter than 3 characters', async () => {
    const wrapper = await mountAt('/archive')
    await flushPromises()

    await wrapper.find('.search-input').setValue('ab')
    await wrapper.find('.search-input').trigger('input')
    await flushPromises()

    expect(mockSearchArchive).not.toHaveBeenCalled()
  })

  it('searches after a debounce once the query reaches 3 characters', async () => {
    vi.useFakeTimers()
    mockSearchArchive.mockResolvedValue({
      data: [{ type: 'dir', id: 9, name: 'Treffer', description: null, path: '/Archiv' }],
    })
    const wrapper = await mountAt('/archive')
    await flushPromises()

    await wrapper.find('.search-input').setValue('Foto')
    await wrapper.find('.search-input').trigger('input')

    expect(mockSearchArchive).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)

    expect(mockSearchArchive).toHaveBeenCalledWith('Foto')
    expect(wrapper.text()).toContain('Treffer')
    vi.useRealTimers()
  })

  it('navigates to the result and clears the search when a search result is clicked', async () => {
    vi.useFakeTimers()
    mockSearchArchive.mockResolvedValue({
      data: [{ type: 'file', id: 9, name: 'Treffer', description: null, path: '/Archiv' }],
    })
    const wrapper = await mountAt('/archive')
    await flushPromises()

    await wrapper.find('.search-input').setValue('Foto')
    await wrapper.find('.search-input').trigger('input')
    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()

    // Using a native dispatchEvent here (instead of VTU's trigger helper)
    // because trigger's internal nextTick await gets orphaned by the
    // preceding fake-timers -> real-timers switch in this test.
    wrapper
      .find('.search-result')
      .element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('archive-file')
    expect(router.currentRoute.value.params.id).toBe('9')
    expect((wrapper.find('.search-input').element as HTMLInputElement).value).toBe('')
  })

  it('clears the search query via the clear icon', async () => {
    const wrapper = await mountAt('/archive')
    await flushPromises()

    await wrapper.find('.search-input').setValue('Foto')
    expect(wrapper.find('.search-clear').exists()).toBe(true)

    await wrapper.find('.search-clear').trigger('click')

    expect((wrapper.find('.search-input').element as HTMLInputElement).value).toBe('')
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
