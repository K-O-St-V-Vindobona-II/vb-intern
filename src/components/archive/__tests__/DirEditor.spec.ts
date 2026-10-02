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

async function openEditor(props: Record<string, unknown>) {
  const wrapper = mount(DirEditor, {
    props: { sets, ...props },
    global: { plugins: [PrimeVue] },
    attachTo: document.body,
  })
  await wrapper.find('button').trigger('click')
  await flushPromises()
  return wrapper
}

function typeName(value: string) {
  const nameInput = document.querySelector<HTMLInputElement>('.editor-form input')!
  nameInput.value = value
  nameInput.dispatchEvent(new Event('input'))
  return flushPromises()
}

function findSaveButton() {
  return Array.from(document.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('Speichern'),
  ) as HTMLButtonElement
}

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
        dirId: '5',
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
      props: { sets, create: true, parentId: '3' },
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
      expect.objectContaining({ name: 'Neues Verzeichnis', parentId: '3' }),
    )
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))

    wrapper.unmount()
  })

  it('updates an existing directory', async () => {
    const wrapper = mount(DirEditor, {
      props: { sets, dirId: '5', dirName: 'Fotos' },
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

    expect(mockUpdateDir).toHaveBeenCalledWith('5', expect.objectContaining({ name: 'Fotos' }))

    wrapper.unmount()
  })

  it('shows an error toast when saving fails', async () => {
    mockCreateDir.mockRejectedValueOnce(new Error('failed'))
    const wrapper = await openEditor({ create: true })
    await typeName('Neues Verzeichnis')

    findSaveButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    expect(wrapper.emitted('saved')).toBeUndefined()

    wrapper.unmount()
  })

  it('shows the API detail in the error toast', async () => {
    mockCreateDir.mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), {
        response: { data: { detail: 'Name muss 3-64 Zeichen lang sein.' } },
      }),
    )
    const wrapper = await openEditor({ create: true })
    await typeName('Neues Verzeichnis')

    findSaveButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Name muss 3-64 Zeichen lang sein.' }),
    )
    wrapper.unmount()
  })

  it.each(['', 'ab', '   ab   ', 'x'.repeat(65)])(
    'keeps saving disabled for the invalid name %j',
    async (invalid) => {
      const wrapper = await openEditor({ create: true })
      await typeName(invalid)

      expect(findSaveButton().disabled).toBe(true)
      findSaveButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushPromises()
      expect(mockCreateDir).not.toHaveBeenCalled()

      wrapper.unmount()
    },
  )

  it('marks a non-empty invalid name with the error hint, but not an empty field', async () => {
    const wrapper = await openEditor({ create: true })
    expect(document.querySelector('.field-error')).toBeFalsy()

    await typeName('ab')

    expect(document.querySelector('.field-error')?.textContent).toContain('3 bis 64 Zeichen')
    wrapper.unmount()
  })

  it('sends the trimmed name', async () => {
    const wrapper = await openEditor({ create: true })
    await typeName('  Fotos 2026  ')

    findSaveButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockCreateDir).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fotos 2026' }))
    wrapper.unmount()
  })

  it('reports an error instead of a false success when editing without a dirId', async () => {
    const wrapper = await openEditor({ dirName: 'Fotos' })

    findSaveButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockUpdateDir).not.toHaveBeenCalled()
    expect(mockCreateDir).not.toHaveBeenCalled()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    wrapper.unmount()
  })

  it('associates the name and description labels with their inputs and names the edit button', async () => {
    const wrapper = mount(DirEditor, {
      props: { sets, dirId: '5', dirName: 'Fotos' },
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })
    expect(wrapper.find('button').attributes('aria-label')).toBe('Verzeichnis bearbeiten')

    await wrapper.find('button').trigger('click')
    await flushPromises()

    const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('.editor-form label'))
    const nameLabel = labels.find((l) => l.textContent === 'Name')!
    const descriptionLabel = labels.find((l) => l.textContent === 'Beschreibung')!
    expect(document.getElementById(nameLabel.htmlFor)?.tagName).toBe('INPUT')
    expect(document.getElementById(descriptionLabel.htmlFor)?.tagName).toBe('INPUT')
    expect(nameLabel.htmlFor).not.toBe(descriptionLabel.htmlFor)

    wrapper.unmount()
  })
})
