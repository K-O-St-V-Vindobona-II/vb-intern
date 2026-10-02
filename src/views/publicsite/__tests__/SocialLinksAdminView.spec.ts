import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import SocialLinksAdminView from '../SocialLinksAdminView.vue'

const FACEBOOK_ID = '0199a1c0-0000-7000-8000-000000000001'
const INSTAGRAM_ID = '0199a1c0-0000-7000-8000-000000000002'
const LINKEDIN_ID = '0199a1c0-0000-7000-8000-000000000003'

const baseLinks = [
  {
    id: FACEBOOK_ID,
    platform: 'facebook',
    label: 'Facebook',
    url: 'https://www.facebook.com/vindobona2',
    is_enabled: false,
  },
  {
    id: INSTAGRAM_ID,
    platform: 'instagram',
    label: 'Instagram',
    url: 'https://www.instagram.com/vindobona2',
    is_enabled: true,
  },
]

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockList = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockMove = vi.fn()
const mockRemove = vi.fn()

vi.mock('@/services/publicContentService', () => ({
  socialLinksService: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    move: (...args: unknown[]) => mockMove(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
}))

describe('SocialLinksAdminView', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    mockToastAdd.mockReset()
    mockList.mockReset().mockResolvedValue({ data: structuredClone(baseLinks) })
    mockCreate.mockReset().mockResolvedValue({
      data: {
        id: LINKEDIN_ID,
        platform: 'linkedin',
        label: 'LinkedIn',
        url: 'https://x',
        is_enabled: true,
      },
    })
    mockUpdate.mockReset().mockResolvedValue({ data: baseLinks[0] })
    mockMove.mockReset().mockResolvedValue({ data: { status: 'ok' } })
    mockRemove.mockReset().mockResolvedValue({ data: undefined })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const mountView = async () => {
    wrapper = mount(SocialLinksAdminView, {
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('renders both links with their enabled state', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Social Media Verweise')
    expect(w.text()).toContain('Facebook')
    expect(w.text()).toContain('Instagram')
    expect(w.text()).toContain('Aktiv')
    expect(w.text()).toContain('Deaktiviert')
  })

  it('adds a new link', async () => {
    const w = await mountView()
    const platformInput = w
      .findAll('input')
      .find((i) => (i.element as HTMLInputElement).placeholder === 'Kennung (z. B. linkedin)')
    const labelInput = w
      .findAll('input')
      .find((i) => (i.element as HTMLInputElement).placeholder === 'Anzeigename')
    const urlInput = w
      .findAll('input')
      .find((i) => (i.element as HTMLInputElement).placeholder === 'https://…')
    await platformInput?.setValue('LinkedIn')
    await labelInput?.setValue('LinkedIn')
    await urlInput?.setValue('https://linkedin.com/company/vindobona2')

    const addButton = w.findAll('button').find((b) => b.text() === 'Hinzufügen')
    await addButton?.trigger('click')
    await flushPromises()

    // Platform is lowercased client-side before it's sent — matches the
    // backend's slug CHECK constraint (only lowercase allowed).
    expect(mockCreate).toHaveBeenCalledWith({
      platform: 'linkedin',
      label: 'LinkedIn',
      url: 'https://linkedin.com/company/vindobona2',
      is_enabled: true,
    })
  })

  it('toggles is_enabled via the edit dialog', async () => {
    const w = await mountView()
    const editButtons = w.findAll('button').filter((b) => b.text().includes('Bearbeiten'))
    await editButtons[0]?.trigger('click') // Facebook, currently disabled
    await flushPromises()

    const checkbox = document.querySelector<HTMLInputElement>(
      '.p-dialog-content input[type="checkbox"]',
    )
    checkbox?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )
    saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockUpdate).toHaveBeenCalledWith(FACEBOOK_ID, {
      label: 'Facebook',
      url: 'https://www.facebook.com/vindobona2',
      is_enabled: true,
    })
  })

  it('moves a link up', async () => {
    const w = await mountView()
    const upButtons = w.findAll('button[aria-label^="Nach oben verschieben"]')
    await upButtons[1]?.trigger('click')
    await flushPromises()

    expect(mockMove).toHaveBeenCalledWith(INSTAGRAM_ID, 'up')
  })

  it('deletes a link after confirming', async () => {
    const w = await mountView()
    const deleteButtons = w.findAll('button').filter((b) => b.text().includes('Löschen'))
    await deleteButtons[0]?.trigger('click')
    await flushPromises()

    const confirmButton = Array.from(document.querySelectorAll('.p-dialog button')).find(
      (b) => b.textContent === 'Löschen',
    )
    confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockRemove).toHaveBeenCalledWith(FACEBOOK_ID)
  })

  const clickDialogButton = async (label: string) => {
    Array.from(document.querySelectorAll('.p-dialog button'))
      .find((b) => b.textContent === label)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
  }

  const field = (w: VueWrapper, placeholder: string) =>
    w.find(`input[placeholder="${placeholder}"]`)
  const addButton = (w: VueWrapper) => w.findAll('button').find((b) => b.text() === 'Hinzufügen')

  it('shows a toast and a retry button instead of an empty list when loading fails', async () => {
    mockList.mockRejectedValueOnce({ response: { data: { detail: 'Serverfehler' } } })
    const w = await mountView()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Serverfehler' }),
    )
    expect(w.text()).toContain('Social-Media-Links konnten nicht geladen werden.')
    expect(w.text()).not.toContain('Keine Social-Media-Links vorhanden.')

    await w
      .findAll('button')
      .find((b) => b.text().includes('Erneut versuchen'))
      ?.trigger('click')
    await flushPromises()

    expect(w.text()).toContain('Instagram')
  })

  it('regression: sends label and address without surrounding blanks', async () => {
    const w = await mountView()
    await field(w, 'Kennung (z. B. linkedin)').setValue(' linkedin ')
    await field(w, 'Anzeigename').setValue('  LinkedIn ')
    await field(w, 'https://…').setValue('  https://linkedin.com/company/vindobona2 \n')

    await addButton(w)?.trigger('click')
    await flushPromises()

    expect(mockCreate).toHaveBeenCalledWith({
      platform: 'linkedin',
      label: 'LinkedIn',
      url: 'https://linkedin.com/company/vindobona2',
      is_enabled: true,
    })
  })

  it.each([
    ['contains a blank', 'link edin'],
    ['contains a hyphen', 'link-edin'],
    ['starts with a digit', '1linkedin'],
    ['contains an umlaut', 'lünkedin'],
  ])('regression: refuses an identifier that %s before the API has to', async (_label, slug) => {
    const w = await mountView()
    await field(w, 'Kennung (z. B. linkedin)').setValue(slug)
    await field(w, 'Anzeigename').setValue('LinkedIn')
    await field(w, 'https://…').setValue('https://linkedin.com')

    expect(addButton(w)?.attributes('disabled')).toBeDefined()
    await addButton(w)?.trigger('click')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('accepts an identifier in capitals and lowers it', async () => {
    const w = await mountView()
    await field(w, 'Kennung (z. B. linkedin)').setValue('Linked_In2')
    await field(w, 'Anzeigename').setValue('LinkedIn')
    await field(w, 'https://…').setValue('https://linkedin.com')

    await addButton(w)?.trigger('click')
    await flushPromises()

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ platform: 'linked_in2' }))
  })

  it('shows a toast and keeps the input when adding fails', async () => {
    mockCreate.mockRejectedValue({
      response: { data: { detail: 'Link muss mit http:// oder https:// beginnen.' } },
    })
    const w = await mountView()
    await field(w, 'Kennung (z. B. linkedin)').setValue('linkedin')
    await field(w, 'Anzeigename').setValue('LinkedIn')
    await field(w, 'https://…').setValue('ftp://x')

    await addButton(w)?.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Link muss mit http:// oder https:// beginnen.',
      }),
    )
    expect((field(w, 'https://…').element as HTMLInputElement).value).toBe('ftp://x')
  })

  it('regression: reordering does not rebuild the page', async () => {
    const w = await mountView()
    const input = field(w, 'Anzeigename').element

    await w.findAll('button[aria-label^="Nach oben verschieben"]')[1]?.trigger('click')
    await flushPromises()

    expect(mockList).toHaveBeenCalledTimes(2)
    expect(field(w, 'Anzeigename').element).toBe(input)
  })

  it('regression: the row buttons wait for a pending move', async () => {
    let resolveMove!: (value: unknown) => void
    mockMove.mockReturnValueOnce(new Promise((resolve) => (resolveMove = resolve)))
    const w = await mountView()

    await w.findAll('button[aria-label^="Nach oben verschieben"]')[1]?.trigger('click')

    expect(
      w.findAll('button[aria-label^="Nach "]').every((b) => b.attributes('disabled') !== undefined),
    ).toBe(true)
    resolveMove({ data: { status: 'ok' } })
    await flushPromises()
    expect(
      w.findAll('button[aria-label^="Nach oben verschieben"]')[1]?.attributes('disabled'),
    ).toBeUndefined()
  })

  it('regression: names the row buttons, the add fields and the dialog checkbox', async () => {
    const w = await mountView()

    expect(w.find('button[aria-label="Löschen: Facebook"]').exists()).toBe(true)
    expect(w.find('button[aria-label="Bearbeiten: Instagram"]').exists()).toBe(true)
    expect(w.find('input[aria-label="Kennung des neuen Verweises"]').exists()).toBe(true)
    expect(w.find('input[aria-label="Anzeigename des neuen Verweises"]').exists()).toBe(true)
    expect(w.find('input[aria-label="Adresse des neuen Verweises"]').exists()).toBe(true)

    await w
      .findAll('button')
      .filter((b) => b.text().includes('Bearbeiten'))[0]
      ?.trigger('click')
    await flushPromises()
    expect(document.querySelector('label[for="edit-link-enabled"]')).not.toBeNull()
    expect(document.querySelector('input#edit-link-enabled')).not.toBeNull()
  })

  it('regression: the edit dialog sends trimmed values and cannot save a blank address', async () => {
    const w = await mountView()
    await w
      .findAll('button')
      .filter((b) => b.text().includes('Bearbeiten'))[0]
      ?.trigger('click')
    await flushPromises()
    const url = document.querySelector<HTMLInputElement>('#edit-link-url')!
    url.value = ' https://www.facebook.com/neu '
    url.dispatchEvent(new Event('input'))
    await clickDialogButton('Speichern')
    expect(mockUpdate).toHaveBeenCalledWith(FACEBOOK_ID, {
      label: 'Facebook',
      url: 'https://www.facebook.com/neu',
      is_enabled: false,
    })

    await w
      .findAll('button')
      .filter((b) => b.text().includes('Bearbeiten'))[0]
      ?.trigger('click')
    await flushPromises()
    const blank = document.querySelector<HTMLInputElement>('#edit-link-url')!
    blank.value = ' '
    blank.dispatchEvent(new Event('input'))
    await flushPromises()
    const save = Array.from(document.querySelectorAll('.p-dialog button')).find(
      (b) => b.textContent === 'Speichern',
    )
    expect(save?.hasAttribute('disabled')).toBe(true)
  })

  it('keeps the link in the list when deleting fails', async () => {
    mockRemove.mockRejectedValue({ response: { data: { detail: 'Löschen kaputt' } } })
    const w = await mountView()
    await w
      .findAll('button')
      .filter((b) => b.text().includes('Löschen'))[0]
      ?.trigger('click')
    await flushPromises()

    await clickDialogButton('Löschen')

    expect(w.text()).toContain('Facebook')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Löschen kaputt' }),
    )
  })

  describe('required fields, refreshed list, failures, limits and row names', () => {
    const fillAdd = async (w: VueWrapper, platform: string, label: string, url: string) => {
      await w.find('input[aria-label="Kennung des neuen Verweises"]').setValue(platform)
      await w.find('input[aria-label="Anzeigename des neuen Verweises"]').setValue(label)
      await w.find('input[aria-label="Adresse des neuen Verweises"]').setValue(url)
    }
    const addButton = (w: VueWrapper) => w.findAll('button').find((b) => b.text() === 'Hinzufügen')
    const setDialogField = async (id: string, value: string) => {
      const input = document.querySelector<HTMLInputElement>(id)!
      input.value = value
      input.dispatchEvent(new Event('input'))
      await flushPromises()
    }

    it.each([
      ['a blank display name', 'linkedin', '   ', 'https://linkedin.com/x'],
      ['a blank address', 'linkedin', 'LinkedIn', '   '],
      ['an invalid identifier', 'link-edin', 'LinkedIn', 'https://linkedin.com/x'],
    ])('does not offer to add with %s', async (_label, platform, label, url) => {
      const w = await mountView()

      await fillAdd(w, platform, label, url)

      expect(addButton(w)?.attributes('disabled')).toBeDefined()
    })

    it('offers to add once identifier, name and address are valid', async () => {
      const w = await mountView()

      await fillAdd(w, 'linkedin', 'LinkedIn', 'https://linkedin.com/x')

      expect(addButton(w)?.attributes('disabled')).toBeUndefined()
    })

    it('does not add anything while a value is missing, even when asked directly', async () => {
      const w = await mountView()
      await fillAdd(w, 'linkedin', '', 'https://linkedin.com/x')
      const vm = w.vm as unknown as { addLink: () => Promise<void> }

      await vm.addLink()

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it.each([
      ['name', '   ', 'https://www.facebook.com/vindobona2'],
      ['address', 'Facebook', '   '],
    ])('does not offer to save an edit with a blank %s', async (_label, label, url) => {
      const w = await mountView()
      await w.findAll('button[aria-label^="Bearbeiten"]')[0]?.trigger('click')
      await flushPromises()
      await setDialogField('#edit-link-label', label)
      await setDialogField('#edit-link-url', url)

      const save = Array.from(document.querySelectorAll('.p-dialog button')).find(
        (b) => b.textContent === 'Speichern',
      )
      expect(save?.hasAttribute('disabled')).toBe(true)
    })

    it('offers to save an edit with a name and an address', async () => {
      const w = await mountView()
      await w.findAll('button[aria-label^="Bearbeiten"]')[0]?.trigger('click')
      await flushPromises()

      const save = Array.from(document.querySelectorAll('.p-dialog button')).find(
        (b) => b.textContent === 'Speichern',
      )
      expect(save?.hasAttribute('disabled')).toBe(false)
    })

    it('marks an invalid identifier and names the allowed characters', async () => {
      const w = await mountView()
      const platform = w.findComponent({ name: 'InputText' })

      await fillAdd(w, 'link-edin', 'LinkedIn', 'https://linkedin.com/x')

      expect(platform.props('invalid')).toBe(true)
      expect(w.text()).toContain('Kleinbuchstaben, Ziffern und Unterstrich')

      await w.find('input[aria-label="Kennung des neuen Verweises"]').setValue('linkedin')
      expect(platform.props('invalid')).toBe(false)
    })

    it.each([
      [
        'adding a link',
        async (w: VueWrapper) => {
          await fillAdd(w, 'linkedin', 'LinkedIn', 'https://linkedin.com/x')
          await addButton(w)?.trigger('click')
        },
      ],
      [
        'moving a link',
        async (w: VueWrapper) => {
          await w.findAll('button[aria-label^="Nach unten verschieben"]')[0]?.trigger('click')
        },
      ],
      [
        'saving an edit',
        async (w: VueWrapper) => {
          await w.findAll('button[aria-label^="Bearbeiten"]')[0]?.trigger('click')
          await flushPromises()
          await clickDialogButton('Speichern')
        },
      ],
    ])('shows the list as the API returns it after %s', async (_label, act) => {
      const w = await mountView()
      mockList.mockResolvedValue({
        data: [{ ...baseLinks[0], label: 'Nachgeladen', is_enabled: true }],
      })

      await act(w)
      await flushPromises()

      expect(mockList).toHaveBeenCalledTimes(2)
      expect(w.text()).toContain('Nachgeladen')
      expect(w.text()).not.toContain('Instagram')
    })

    it('shows the API reason when moving or saving fails, with a specific fallback otherwise', async () => {
      mockMove.mockRejectedValueOnce({ response: { data: { detail: 'Verschieben kaputt' } } })
      mockUpdate.mockRejectedValueOnce({ response: { data: { detail: 'Speichern kaputt' } } })
      const w = await mountView()

      await w.findAll('button[aria-label^="Nach unten verschieben"]')[0]?.trigger('click')
      await flushPromises()
      expect(mockToastAdd).toHaveBeenLastCalledWith(
        expect.objectContaining({ detail: 'Verschieben kaputt' }),
      )
      await w.findAll('button[aria-label^="Bearbeiten"]')[0]?.trigger('click')
      await flushPromises()
      await clickDialogButton('Speichern')
      expect(mockToastAdd).toHaveBeenLastCalledWith(
        expect.objectContaining({ detail: 'Speichern kaputt' }),
      )

      mockMove.mockRejectedValueOnce(new Error('offline'))
      mockUpdate.mockRejectedValueOnce(new Error('offline'))
      await w.findAll('button[aria-label^="Nach unten verschieben"]')[0]?.trigger('click')
      await flushPromises()
      expect(mockToastAdd).toHaveBeenLastCalledWith(
        expect.objectContaining({ detail: 'Verschieben fehlgeschlagen.' }),
      )
      await clickDialogButton('Speichern')
      expect(mockToastAdd).toHaveBeenLastCalledWith(
        expect.objectContaining({ detail: 'Speichern fehlgeschlagen.' }),
      )
    })

    it('reports a failed re-read after a change and keeps the list', async () => {
      const w = await mountView()
      mockList.mockRejectedValueOnce(new Error('offline'))

      await w.findAll('button[aria-label^="Nach unten verschieben"]')[0]?.trigger('click')
      await flushPromises()

      expect(mockToastAdd).toHaveBeenLastCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Social-Media-Links konnten nicht aktualisiert werden.',
        }),
      )
      expect(w.text()).toContain('Facebook')
      expect(w.text()).toContain('Instagram')
    })

    it('limits identifier, name and address to what the API accepts', async () => {
      const w = await mountView()
      const limit = (label: string) =>
        w.find(`input[aria-label="${label}"]`).attributes('maxlength')

      expect(limit('Kennung des neuen Verweises')).toBe('40')
      expect(limit('Anzeigename des neuen Verweises')).toBe('60')
      expect(limit('Adresse des neuen Verweises')).toBe('500')
    })

    it('names the move buttons after their link', async () => {
      const w = await mountView()

      expect(w.find('button[aria-label="Nach unten verschieben: Facebook"]').exists()).toBe(true)
      expect(w.find('button[aria-label="Nach oben verschieben: Instagram"]').exists()).toBe(true)
    })
  })
})
