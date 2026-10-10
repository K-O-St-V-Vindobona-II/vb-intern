import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ArchiveFileView from '../ArchiveFileView.vue'
import PrimeVue from 'primevue/config'
import type { FileDetail } from '@/types/archive'

const DIR_ID = '0199a1c3-0000-7000-8000-000000000005'
const OTHER_DIR_ID = '0199a1c3-0000-7000-8000-000000000007'

function buildFile(overrides: Partial<FileDetail> = {}): FileDetail {
  return {
    type: 'file',
    id: '1',
    archive_dir_id: DIR_ID,
    name: 'Bericht',
    extension: 'pdf',
    description: 'Jahresbericht',
    size: 2048,
    is_image: false,
    mime_type: 'application/pdf',
    path: [],
    active_version: {
      id: '1',
      name: 'Bericht',
      description: null,
      extension: 'pdf',
      mime_type: 'application/pdf',
      size: 2048,
      is_image: false,
      created_by: 'Max Mustermann',
      created_at: '2026-06-01T00:00:00Z',
    },
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

    expect(mockGetFileDetail).toHaveBeenCalledWith('1')
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

  it('shows an error state with a retry button on a non-404/403 failure', async () => {
    mockGetFileDetail.mockRejectedValueOnce({ response: { status: 500 } })
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()

    expect(router.currentRoute.value.name).not.toBe('not-found')
    expect(wrapper.find('.archive-error').exists()).toBe(true)
    expect(wrapper.text()).toContain('Datei konnte nicht geladen werden.')
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))

    mockGetFileDetail.mockResolvedValueOnce({ data: buildFile() })
    await wrapper.find('.archive-error button').trigger('click')
    await flushPromises()

    expect(wrapper.find('.archive-error').exists()).toBe(false)
    expect(wrapper.text()).toContain('Bericht.pdf')
  })

  it('triggers a download with the file name and extension when the card is clicked', async () => {
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()

    await wrapper.find('.download-link').trigger('click')

    expect(mockTriggerDownload).toHaveBeenCalledWith('1', 'Bericht.pdf')
  })

  it('does not show the path row when the file has no path entries', async () => {
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()
    expect(wrapper.find('.file-path-row').exists()).toBe(false)
  })

  it('shows the path row when the file has path entries', async () => {
    mockGetFileDetail.mockResolvedValue({
      data: buildFile({ path: [{ id: DIR_ID, name: 'Fotos' }] }),
    })
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()
    expect(wrapper.find('.file-path-row').exists()).toBe(true)
  })

  it('shows the creator of the active version', async () => {
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
    const input = document.querySelector('#edit-file-description') as HTMLInputElement
    expect(input.value).toBe('Jahresbericht')
  })

  it('saves the edited description and reloads the file', async () => {
    mockAuthStore.user = { permissions: ['archiveAdmin'] }
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()

    await wrapper.find('.info-row button').trigger('click')
    await flushPromises()

    const input = document.querySelector('#edit-file-description') as HTMLInputElement
    input.value = 'Neue Beschreibung'
    input.dispatchEvent(new Event('input'))
    await flushPromises()

    const saveBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Speichern'),
    )!
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockUpdateFile).toHaveBeenCalledWith('1', { description: 'Neue Beschreibung' })
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
    mockGetFileDetail.mockResolvedValue({ data: buildFile({ archive_dir_id: OTHER_DIR_ID }) })
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()

    const backBtn = wrapper.findAll('button').find((b) => b.text().includes('Zum Verzeichnis'))!
    await backBtn.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('archive-dir')
    expect(router.currentRoute.value.params['id']).toBe(OTHER_DIR_ID)
  })

  it('navigates to the archive root when the file has no parent directory', async () => {
    mockGetFileDetail.mockResolvedValue({ data: buildFile({ archive_dir_id: null }) })
    const wrapper = await mountAt('/archive/files/1')
    await flushPromises()

    const backBtn = wrapper.findAll('button').find((b) => b.text().includes('Zum Verzeichnis'))!
    await backBtn.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('archive-root')
  })

  describe('description dialog', () => {
    const openDialog = async () => {
      mockAuthStore.user = { permissions: ['archiveAdmin'] }
      const wrapper = await mountAt('/archive/files/1')
      await flushPromises()
      await wrapper.find('.info-row button').trigger('click')
      await flushPromises()
      return wrapper
    }
    const descriptionInput = () =>
      document.querySelector('#edit-file-description') as HTMLInputElement
    const type = async (value: string) => {
      descriptionInput().value = value
      descriptionInput().dispatchEvent(new Event('input'))
      await flushPromises()
    }
    const saveButton = () =>
      Array.from(document.querySelectorAll('.p-dialog button')).find(
        (b) => b.textContent === 'Speichern',
      ) as HTMLButtonElement
    const save = async () => {
      saveButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushPromises()
    }

    it('regression: takes no more characters than the API accepts', async () => {
      await openDialog()

      expect(descriptionInput().getAttribute('maxlength')).toBe('128')
    })

    it('regression: shows the reason the API gave when saving fails', async () => {
      mockUpdateFile.mockRejectedValueOnce({
        response: { data: { detail: 'Beschreibung max. 128 Zeichen.' } },
      })
      await openDialog()

      await save()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Beschreibung max. 128 Zeichen.',
        }),
      )
    })

    it('regression: sends the description without surrounding blanks and none when it is blank', async () => {
      await openDialog()
      await type('  Neu  ')
      await save()
      expect(mockUpdateFile).toHaveBeenLastCalledWith('1', { description: 'Neu' })

      const wrapper = activeWrapper!
      await wrapper.find('.info-row button').trigger('click')
      await flushPromises()
      await type('    ')
      await save()
      expect(mockUpdateFile).toHaveBeenLastCalledWith('1', { description: null })
    })

    it('regression: the save button is not styled as a destructive action', async () => {
      await openDialog()

      expect(saveButton().classList.contains('p-button-danger')).toBe(false)
    })

    it('regression: labels the field and stays inside a narrow screen', async () => {
      const wrapper = await openDialog()

      expect(document.querySelector('label[for="edit-file-description"]')).not.toBeNull()
      expect(wrapper.findComponent({ name: 'Dialog' }).props('breakpoints')).toEqual({
        '600px': '95vw',
      })
    })

    it('keeps the dialog open when saving fails', async () => {
      mockUpdateFile.mockRejectedValueOnce(new Error('failed'))
      await openDialog()

      await save()

      expect(document.querySelector('#edit-file-description')).not.toBeNull()
    })

    it('names the icon-only edit button', async () => {
      mockAuthStore.user = { permissions: ['archiveAdmin'] }
      const wrapper = await mountAt('/archive/files/1')
      await flushPromises()

      expect(wrapper.find('.info-row button').attributes('aria-label')).toBe(
        'Beschreibung bearbeiten',
      )
    })
  })

  describe('download card', () => {
    it.each([
      ['Enter', 'Enter'],
      ['Space', ' '],
    ])('regression: %s on the card starts the download', async (_label, key) => {
      const wrapper = await mountAt('/archive/files/1')
      await flushPromises()

      await wrapper.find('.download-link').trigger('keydown', { key })

      expect(mockTriggerDownload).toHaveBeenCalledWith('1', 'Bericht.pdf')
    })

    it('regression: is reachable and announced as a button', async () => {
      const wrapper = await mountAt('/archive/files/1')
      await flushPromises()
      const card = wrapper.find('.download-link')

      expect(card.attributes('role')).toBe('button')
      expect(card.attributes('tabindex')).toBe('0')
      expect(card.attributes('aria-label')).toBe('Bericht.pdf herunterladen')
    })
  })

  describe('reloading', () => {
    function deferredFile() {
      let resolvePromise!: (value: { data: FileDetail }) => void
      let rejectPromise!: (reason: unknown) => void
      const promise = new Promise<{ data: FileDetail }>((resolve, reject) => {
        resolvePromise = resolve
        rejectPromise = reject
      })
      return { promise, resolve: resolvePromise, reject: rejectPromise }
    }

    it('regression: a slow answer for the file opened before does not replace the newer one', async () => {
      const slow = deferredFile()
      mockGetFileDetail
        .mockReturnValueOnce(slow.promise)
        .mockResolvedValueOnce({ data: buildFile({ id: '2', name: 'Neu' }) })
      const wrapper = await mountAt('/archive/files/1')
      await router.push('/archive/files/2')
      await flushPromises()

      slow.resolve({ data: buildFile({ id: '1', name: 'Alt' }) })
      await flushPromises()

      expect(wrapper.text()).toContain('Neu.pdf')
      expect(wrapper.text()).not.toContain('Alt.pdf')
    })

    it('regression: a 404 for a file that was left does not send the user to not-found', async () => {
      const slow = deferredFile()
      mockGetFileDetail
        .mockReturnValueOnce(slow.promise)
        .mockResolvedValueOnce({ data: buildFile({ id: '2', name: 'Neu' }) })
      const wrapper = await mountAt('/archive/files/1')
      await router.push('/archive/files/2')
      await flushPromises()

      slow.reject({ response: { status: 404 } })
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('archive-file')
      expect(wrapper.text()).toContain('Neu.pdf')
    })

    it('does not show the previous file while the next one loads', async () => {
      const slow = deferredFile()
      const wrapper = await mountAt('/archive/files/1')
      await flushPromises()
      expect(wrapper.text()).toContain('Bericht.pdf')
      mockGetFileDetail.mockReturnValueOnce(slow.promise)

      await router.push('/archive/files/2')
      await flushPromises()

      expect(wrapper.text()).not.toContain('Bericht.pdf')
    })

    it('regression: saving the description keeps the page mounted', async () => {
      mockAuthStore.user = { permissions: ['archiveAdmin'] }
      const wrapper = await mountAt('/archive/files/1')
      await flushPromises()
      const card = wrapper.find('.download-link').element

      await wrapper.find('.info-row button').trigger('click')
      await flushPromises()
      const saveBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Speichern'),
      )!
      saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushPromises()

      expect(mockGetFileDetail).toHaveBeenCalledTimes(2)
      expect(wrapper.find('.download-link').element).toBe(card)
    })

    it('regression: a change in the comments keeps the page mounted', async () => {
      const wrapper = await mountAt('/archive/files/1')
      await flushPromises()
      const card = wrapper.find('.download-link').element

      await wrapper.findComponent({ name: 'FileComments' }).vm.$emit('changed')
      await flushPromises()

      expect(mockGetFileDetail).toHaveBeenCalledTimes(2)
      expect(wrapper.find('.download-link').element).toBe(card)
    })

    it('keeps the page and shows a toast when a reload after a change fails', async () => {
      const wrapper = await mountAt('/archive/files/1')
      await flushPromises()
      mockGetFileDetail.mockRejectedValueOnce({ response: { status: 500 } })

      await wrapper.findComponent({ name: 'FileComments' }).vm.$emit('changed')
      await flushPromises()

      expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
      expect(wrapper.find('.archive-error').exists()).toBe(false)
      expect(wrapper.text()).toContain('Bericht.pdf')
    })
  })
})
