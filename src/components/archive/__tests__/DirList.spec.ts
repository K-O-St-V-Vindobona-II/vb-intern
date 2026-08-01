import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import DirList from '../DirList.vue'
import { useArchiveStore } from '@/stores/archive'
import PrimeVue from 'primevue/config'
import type { DirShort } from '@/types/archive'

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

const mockRestoreDir = vi.fn()
const mockDeleteDir = vi.fn()
const mockPurgeDir = vi.fn()
vi.mock('@/services/archiveService', () => ({
  default: {
    restoreDir: (...args: unknown[]) => mockRestoreDir(...args),
    deleteDir: (...args: unknown[]) => mockDeleteDir(...args),
    purgeDir: (...args: unknown[]) => mockPurgeDir(...args),
  },
}))

function buildDir(overrides: Partial<DirShort> = {}): DirShort {
  return {
    type: 'dir',
    id: 1,
    name: 'Fotos',
    description: 'Urlaubsfotos',
    created_at: '2026-06-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  }
}

let activeWrapper: VueWrapper | null = null

function mountDirList(props: Record<string, unknown>) {
  const wrapper = mount(DirList, {
    props,
    global: { plugins: [PrimeVue] },
    attachTo: document.body,
  })
  activeWrapper = wrapper
  return wrapper
}

describe('DirList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    sessionStorage.clear()
    mockRestoreDir.mockResolvedValue({})
    mockDeleteDir.mockResolvedValue({})
    mockPurgeDir.mockResolvedValue({})
  })

  afterEach(() => {
    activeWrapper?.unmount()
    activeWrapper = null
  })

  it('renders nothing when there are no items', () => {
    const wrapper = mountDirList({ items: [], title: 'Verzeichnisse' })
    expect(wrapper.find('.dir-list').exists()).toBe(false)
  })

  it('shows the title with item count and renders a row per directory', () => {
    const wrapper = mountDirList({
      items: [buildDir({ id: 1, name: 'A' }), buildDir({ id: 2, name: 'B' })],
      title: 'Einsicht',
    })
    expect(wrapper.text()).toContain('Einsicht (2)')
    expect(wrapper.text()).toContain('A')
    expect(wrapper.text()).toContain('B')
  })

  it('navigates to the directory when its name link is clicked', async () => {
    const wrapper = mountDirList({ items: [buildDir({ id: 5, name: 'Fotos' })], title: 'Einsicht' })
    await wrapper.find('.dir-link').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'archive-dir', params: { id: 5 } })
  })

  it('navigates into a trashed directory too, so its remaining content can be managed', async () => {
    const wrapper = mountDirList({
      items: [buildDir({ id: 5, name: 'Fotos' })],
      title: 'Papierkorb',
      trash: true,
    })
    await wrapper.find('.dir-link').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'archive-dir', params: { id: 5 } })
  })

  it('does not show selection checkboxes or the clipboard button for non-admins', () => {
    const wrapper = mountDirList({ items: [buildDir()], title: 'Einsicht' })
    expect(wrapper.findComponent({ name: 'Checkbox' }).exists()).toBe(false)
  })

  it('copies selected directories to the clipboard for admins and clears the selection', async () => {
    const store = useArchiveStore()
    const wrapper = mountDirList({
      items: [buildDir({ id: 1 }), buildDir({ id: 2 })],
      title: 'Einsicht',
      admin: true,
    })

    const selectCells = wrapper.findAll('.select-cell')
    // selectCells[0] is the header "select all" cell, [1]/[2] are row cells.
    await selectCells[1]!.trigger('click')

    await wrapper.find('.list-header button').trigger('click')

    expect(store.clipboard).toEqual(['dir:1'])
    expect(wrapper.findComponent({ name: 'Checkbox' }).props('modelValue')).toBe(false)
  })

  it('asks for confirmation before deleting a directory and emits changed on accept', async () => {
    const wrapper = mountDirList({ items: [buildDir({ id: 5 })], title: 'Einsicht', admin: true })

    // No selection checkbox column rendered for trash=false admin row besides the action button.
    await wrapper.find('tbody button').trigger('click')
    expect(mockConfirmRequire).toHaveBeenCalledOnce()
    expect(mockConfirmRequire.mock.calls[0]![0].message).toBe('Verzeichnis wirklich löschen?')

    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockDeleteDir).toHaveBeenCalledWith(5)
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('restores a trashed directory on confirmation', async () => {
    const wrapper = mountDirList({
      items: [buildDir({ id: 5 })],
      title: 'Papierkorb',
      admin: true,
      trash: true,
    })

    await wrapper.find('[aria-label="Wiederherstellen"]').trigger('click')
    expect(mockConfirmRequire.mock.calls[0]![0].message).toBe('Verzeichnis wiederherstellen?')

    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockRestoreDir).toHaveBeenCalledWith(5)
  })

  it('shows an error toast when the delete/restore action fails', async () => {
    mockDeleteDir.mockRejectedValueOnce(new Error('failed'))
    const wrapper = mountDirList({ items: [buildDir({ id: 5 })], title: 'Einsicht', admin: true })

    await wrapper.find('tbody button').trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('shows the purge button only when admin and trash are both true', () => {
    const trashedAdmin = mountDirList({
      items: [buildDir({ id: 5 })],
      title: 'Papierkorb',
      admin: true,
      trash: true,
    })
    expect(trashedAdmin.find('[aria-label="Endgültig löschen"]').exists()).toBe(true)
    trashedAdmin.unmount()

    const trashedNonAdmin = mountDirList({
      items: [buildDir({ id: 5 })],
      title: 'Papierkorb',
      trash: true,
    })
    expect(trashedNonAdmin.find('[aria-label="Endgültig löschen"]').exists()).toBe(false)
    trashedNonAdmin.unmount()

    const adminNotTrashed = mountDirList({
      items: [buildDir({ id: 5 })],
      title: 'Einsicht',
      admin: true,
    })
    expect(adminNotTrashed.find('[aria-label="Endgültig löschen"]').exists()).toBe(false)
  })

  it('asks for confirmation before permanently deleting a directory and emits changed on accept', async () => {
    const wrapper = mountDirList({
      items: [buildDir({ id: 5, name: 'Fotos' })],
      title: 'Papierkorb',
      admin: true,
      trash: true,
    })

    await wrapper.find('[aria-label="Endgültig löschen"]').trigger('click')
    expect(mockConfirmRequire).toHaveBeenCalledOnce()
    expect(mockConfirmRequire.mock.calls[0]![0].message).toBe(
      'Verzeichnis "Fotos" endgültig löschen? Dies kann nicht rückgängig gemacht werden.',
    )

    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockPurgeDir).toHaveBeenCalledWith(5)
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('shows the backend detail message in the toast when purge fails with 409', async () => {
    mockPurgeDir.mockRejectedValueOnce({
      response: {
        data: { detail: 'Verzeichnis ist nicht leer und kann nicht endgültig gelöscht werden.' },
      },
    })
    const wrapper = mountDirList({
      items: [buildDir({ id: 5 })],
      title: 'Papierkorb',
      admin: true,
      trash: true,
    })

    await wrapper.find('[aria-label="Endgültig löschen"]').trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Verzeichnis ist nicht leer und kann nicht endgültig gelöscht werden.',
      }),
    )
  })

  it('shows a fallback error message when purge fails without a response body', async () => {
    mockPurgeDir.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mountDirList({
      items: [buildDir({ id: 5 })],
      title: 'Papierkorb',
      admin: true,
      trash: true,
    })

    await wrapper.find('[aria-label="Endgültig löschen"]').trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Verzeichnis konnte nicht endgültig gelöscht werden.',
      }),
    )
  })
})
