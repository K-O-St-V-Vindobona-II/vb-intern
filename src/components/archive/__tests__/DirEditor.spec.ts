import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DirEditor from '../DirEditor.vue'
import PrimeVue from 'primevue/config'

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockCreateDir = vi.fn()
const mockUpdateDir = vi.fn()
vi.mock('@/services/archiveService', () => ({
  default: {
    createDir: (...args: unknown[]) => mockCreateDir(...args),
    updateDir: (...args: unknown[]) => mockUpdateDir(...args),
  },
}))

const sets = { orgs: [{ id: 'vbw', label: 'Wien' }], states: [{ id: 'active', label: 'Aktiv' }] }

describe('DirEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateDir.mockResolvedValue({})
    mockUpdateDir.mockResolvedValue({})
  })

  it('shows a "create" button when create is set', () => {
    const wrapper = mount(DirEditor, {
      props: { sets, create: true },
      global: { plugins: [PrimeVue] },
    })
    expect(wrapper.text()).toContain('Verzeichnis erstellen')
  })

  it('shows an edit icon button when not creating', () => {
    const wrapper = mount(DirEditor, {
      props: { sets },
      global: { plugins: [PrimeVue] },
    })
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Verzeichnis erstellen')
  })

  it('opens the dialog pre-filled with the existing directory data for editing', async () => {
    const wrapper = mount(DirEditor, {
      props: {
        sets,
        dirId: 5,
        dirName: 'Fotos',
        dirDescription: 'Urlaubsfotos',
        dirPermissions: ['vbw_active'],
        dirRecursive: true,
      },
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(document.body.innerHTML).toContain('Verzeichnis bearbeiten')
    const nameInput = document.querySelector<HTMLInputElement>('.editor-form input')
    expect(nameInput?.value).toBe('Fotos')

    wrapper.unmount()
  })

  it('creates a new directory with the entered values', async () => {
    const wrapper = mount(DirEditor, {
      props: { sets, create: true, parentId: 3 },
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })

    await wrapper.find('button').trigger('click')
    await flushPromises()

    const nameInput = document.querySelector<HTMLInputElement>('.editor-form input')!
    nameInput.value = 'Neues Verzeichnis'
    nameInput.dispatchEvent(new Event('input'))
    await flushPromises()

    const saveButton = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Speichern'),
    )
    saveButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockCreateDir).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Neues Verzeichnis', parentId: 3 }),
    )
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))

    wrapper.unmount()
  })

  it('updates an existing directory', async () => {
    const wrapper = mount(DirEditor, {
      props: { sets, dirId: 5, dirName: 'Fotos' },
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })

    await wrapper.find('button').trigger('click')
    await flushPromises()

    const saveButton = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Speichern'),
    )
    saveButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockUpdateDir).toHaveBeenCalledWith(5, expect.objectContaining({ name: 'Fotos' }))

    wrapper.unmount()
  })

  it('shows an error toast when saving fails', async () => {
    mockCreateDir.mockRejectedValueOnce(new Error('failed'))
    const wrapper = mount(DirEditor, {
      props: { sets, create: true },
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })

    await wrapper.find('button').trigger('click')
    await flushPromises()

    const saveButton = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Speichern'),
    )
    saveButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    expect(wrapper.emitted('saved')).toBeUndefined()

    wrapper.unmount()
  })
})
