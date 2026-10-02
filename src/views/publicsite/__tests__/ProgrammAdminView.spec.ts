import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ProgrammAdminView from '../ProgrammAdminView.vue'

const baseSettings = {
  about_video_heading: 'Erfahre mehr über den MKV',
  about_video_youtube_id: 'Sh51ebB2G8A',
  programm_calendar_id: 'abc@group.calendar.google.com',
  gallery_heading: 'Eindrücke',
}

const FIRST_HINT_ID = '0199a1c1-0000-7000-8000-000000000001'
const SECOND_HINT_ID = '0199a1c1-0000-7000-8000-000000000002'
const THIRD_HINT_ID = '0199a1c1-0000-7000-8000-000000000003'

const baseHints = [
  { id: FIRST_HINT_ID, text: 'Erster Hinweis.' },
  { id: SECOND_HINT_ID, text: 'Zweiter Hinweis.' },
]

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockGetSettings = vi.fn()
const mockUpdateSettings = vi.fn()
const mockListHints = vi.fn()
const mockCreateHint = vi.fn()
const mockUpdateHint = vi.fn()
const mockMoveHint = vi.fn()
const mockRemoveHint = vi.fn()

vi.mock('@/services/publicContentService', () => ({
  siteSettingsService: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
    updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
  },
  programmHintsService: {
    list: (...args: unknown[]) => mockListHints(...args),
    create: (...args: unknown[]) => mockCreateHint(...args),
    update: (...args: unknown[]) => mockUpdateHint(...args),
    move: (...args: unknown[]) => mockMoveHint(...args),
    remove: (...args: unknown[]) => mockRemoveHint(...args),
  },
}))

describe('ProgrammAdminView', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    mockToastAdd.mockReset()
    mockGetSettings.mockReset().mockResolvedValue({ data: { ...baseSettings } })
    mockUpdateSettings.mockReset().mockResolvedValue({ data: { ...baseSettings } })
    mockListHints.mockReset().mockResolvedValue({ data: structuredClone(baseHints) })
    mockCreateHint.mockReset().mockResolvedValue({ data: { id: THIRD_HINT_ID, text: 'Neu' } })
    mockUpdateHint.mockReset().mockResolvedValue({ data: { id: FIRST_HINT_ID, text: 'Geändert' } })
    mockMoveHint.mockReset().mockResolvedValue({ data: { status: 'ok' } })
    mockRemoveHint.mockReset().mockResolvedValue({ data: undefined })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const mountView = async () => {
    wrapper = mount(ProgrammAdminView, {
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('renders the calendar id and the hint list', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Programm')
    expect((w.find('#calendar-id').element as HTMLInputElement).value).toBe(
      'abc@group.calendar.google.com',
    )
    expect(w.text()).toContain('Erster Hinweis.')
    expect(w.text()).toContain('Zweiter Hinweis.')
  })

  it('saves the calendar id, preserving video settings', async () => {
    const w = await mountView()
    await w.find('#calendar-id').setValue('new@group.calendar.google.com')

    const saveButtons = w.findAll('button').filter((b) => b.text() === 'Speichern')
    await saveButtons[0]?.trigger('click')
    await flushPromises()

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      about_video_heading: 'Erfahre mehr über den MKV',
      youtube_url: 'https://www.youtube.com/watch?v=Sh51ebB2G8A',
      calendar_id: 'new@group.calendar.google.com',
      gallery_heading: 'Eindrücke',
    })
  })

  it('adds a new hint', async () => {
    const w = await mountView()
    const newHintInput = w
      .findAll('input')
      .find((i) => (i.element as HTMLInputElement).placeholder === 'Neuer Hinweis')
    await newHintInput?.setValue('Ein neuer Hinweis')

    const addButton = w.findAll('button').find((b) => b.text() === 'Hinzufügen')
    await addButton?.trigger('click')
    await flushPromises()

    expect(mockCreateHint).toHaveBeenCalledWith({ text: 'Ein neuer Hinweis' })
  })

  it('moves a hint up', async () => {
    const w = await mountView()
    const upButtons = w.findAll('button[aria-label^="Nach oben verschieben"]')
    await upButtons[1]?.trigger('click')
    await flushPromises()

    expect(mockMoveHint).toHaveBeenCalledWith(SECOND_HINT_ID, 'up')
  })

  it('deletes a hint after confirming', async () => {
    const w = await mountView()
    const deleteButtons = w.findAll('button[aria-label^="Löschen"]')
    await deleteButtons[0]?.trigger('click')
    await flushPromises()

    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Löschen',
    )
    confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockRemoveHint).toHaveBeenCalledWith(FIRST_HINT_ID)
  })

  const clickDialogButton = async (label: string) => {
    Array.from(document.querySelectorAll('.p-dialog button'))
      .find((b) => b.textContent === label)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
  }

  it('shows a toast and a retry button when the data cannot be loaded', async () => {
    mockListHints.mockRejectedValueOnce({ response: { data: { detail: 'Serverfehler' } } })
    const w = await mountView()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Serverfehler' }),
    )
    expect(w.text()).not.toContain('Keine Hinweise vorhanden.')

    await w
      .findAll('button')
      .find((b) => b.text().includes('Erneut versuchen'))
      ?.trigger('click')
    await flushPromises()

    expect(w.text()).toContain('Erster Hinweis.')
  })

  it('regression: saves the calendar on top of the settings stored right now', async () => {
    const w = await mountView()
    mockGetSettings.mockResolvedValue({
      data: { ...baseSettings, about_video_heading: 'Anderswo geändert' },
    })
    await w.find('#calendar-id').setValue('  new@group.calendar.google.com  ')

    await w
      .findAll('button')
      .find((b) => b.text() === 'Speichern')
      ?.trigger('click')
    await flushPromises()

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      about_video_heading: 'Anderswo geändert',
      youtube_url: 'https://www.youtube.com/watch?v=Sh51ebB2G8A',
      calendar_id: 'new@group.calendar.google.com',
      gallery_heading: 'Eindrücke',
    })
  })

  it('does not offer to save a blank calendar', async () => {
    const w = await mountView()
    await w.find('#calendar-id').setValue('  ')

    expect(
      w
        .findAll('button')
        .find((b) => b.text() === 'Speichern')
        ?.attributes('disabled'),
    ).toBeDefined()
  })

  it('regression: adds the hint without surrounding blanks', async () => {
    const w = await mountView()
    const input = w.find('input[placeholder="Neuer Hinweis"]')
    await input.setValue('  Ein neuer Hinweis  ')

    await w
      .findAll('button')
      .find((b) => b.text() === 'Hinzufügen')
      ?.trigger('click')
    await flushPromises()

    expect(mockCreateHint).toHaveBeenCalledWith({ text: 'Ein neuer Hinweis' })
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('does not add a hint that is only blanks', async () => {
    const w = await mountView()
    await w.find('input[placeholder="Neuer Hinweis"]').setValue('    ')

    const add = w.findAll('button').find((b) => b.text() === 'Hinzufügen')
    expect(add?.attributes('disabled')).toBeDefined()
    await add?.trigger('click')
    expect(mockCreateHint).not.toHaveBeenCalled()
  })

  it('shows a toast and keeps the input when adding fails', async () => {
    mockCreateHint.mockRejectedValue({ response: { data: { detail: 'Hinzufügen kaputt' } } })
    const w = await mountView()
    const input = w.find('input[placeholder="Neuer Hinweis"]')
    await input.setValue('Ein Hinweis')

    await w
      .findAll('button')
      .find((b) => b.text() === 'Hinzufügen')
      ?.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Hinzufügen kaputt' }),
    )
    expect((input.element as HTMLInputElement).value).toBe('Ein Hinweis')
  })

  it('edits a hint and sends the trimmed text', async () => {
    const w = await mountView()
    await w.find('button[aria-label^="Bearbeiten"]').trigger('click')
    await flushPromises()
    const input = document.querySelector<HTMLInputElement>('#edit-hint-text')!
    expect(input.value).toBe('Erster Hinweis.')
    input.value = '  Geändert  '
    input.dispatchEvent(new Event('input'))

    await clickDialogButton('Speichern')

    expect(mockUpdateHint).toHaveBeenCalledWith(FIRST_HINT_ID, { text: 'Geändert' })
  })

  it('regression: the edit dialog cannot save a blank text', async () => {
    const w = await mountView()
    await w.find('button[aria-label^="Bearbeiten"]').trigger('click')
    await flushPromises()
    const input = document.querySelector<HTMLInputElement>('#edit-hint-text')!
    input.value = '   '
    input.dispatchEvent(new Event('input'))
    await flushPromises()

    const save = Array.from(document.querySelectorAll('.p-dialog button')).find(
      (b) => b.textContent === 'Speichern',
    )
    expect(save?.hasAttribute('disabled')).toBe(true)
  })

  it('regression: the row buttons wait for a pending move', async () => {
    let resolveMove!: (value: unknown) => void
    mockMoveHint.mockReturnValueOnce(new Promise((resolve) => (resolveMove = resolve)))
    const w = await mountView()

    await w.findAll('button[aria-label^="Nach oben verschieben"]')[1]?.trigger('click')

    const moveButtons = w.findAll('button[aria-label^="Nach "]')
    expect(moveButtons.every((b) => b.attributes('disabled') !== undefined)).toBe(true)
    resolveMove({ data: { status: 'ok' } })
    await flushPromises()
    expect(
      w.findAll('button[aria-label^="Nach oben verschieben"]')[1]?.attributes('disabled'),
    ).toBeUndefined()
  })

  it('regression: names the icon buttons after their hint', async () => {
    const w = await mountView()

    expect(w.find('button[aria-label="Löschen: Zweiter Hinweis."]').exists()).toBe(true)
    expect(w.find('button[aria-label="Bearbeiten: Erster Hinweis."]').exists()).toBe(true)
    expect(w.find('input[aria-label="Neuer Hinweis"]').exists()).toBe(true)
  })

  it('removes the hint from the list after it was deleted and keeps it when deleting fails', async () => {
    mockRemoveHint.mockRejectedValueOnce({ response: { data: { detail: 'Löschen kaputt' } } })
    const w = await mountView()

    await w.find('button[aria-label^="Löschen"]').trigger('click')
    await flushPromises()
    await clickDialogButton('Löschen')
    expect(w.text()).toContain('Erster Hinweis.')
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))

    await w.find('button[aria-label^="Löschen"]').trigger('click')
    await flushPromises()
    await clickDialogButton('Löschen')
    expect(w.text()).not.toContain('Erster Hinweis.')
  })

  describe('field limits, server values and row names', () => {
    it('limits the calendar, the new hint and the edited hint to what the API accepts', async () => {
      const w = await mountView()
      expect(w.find('#calendar-id').attributes('maxlength')).toBe('500')
      expect(w.find('input[aria-label="Neuer Hinweis"]').attributes('maxlength')).toBe('300')

      await w.find('button[aria-label^="Bearbeiten"]').trigger('click')
      await flushPromises()
      expect(document.querySelector('#edit-hint-text')?.getAttribute('maxlength')).toBe('300')
    })

    it('offers to save a non-blank edited hint', async () => {
      const w = await mountView()
      await w.find('button[aria-label^="Bearbeiten"]').trigger('click')
      await flushPromises()

      const save = Array.from(document.querySelectorAll('.p-dialog button')).find(
        (b) => b.textContent === 'Speichern',
      )
      expect(save?.hasAttribute('disabled')).toBe(false)
    })

    it('does not add a blank hint when Enter is pressed', async () => {
      const w = await mountView()
      const input = w.find('input[aria-label="Neuer Hinweis"]')
      await input.setValue('   ')

      await input.trigger('keyup.enter')
      await flushPromises()

      expect(mockCreateHint).not.toHaveBeenCalled()
    })

    it('shows the calendar as the API stored it after saving', async () => {
      const w = await mountView()
      mockUpdateSettings.mockResolvedValue({
        data: { ...baseSettings, programm_calendar_id: 'vom-server@group.calendar.google.com' },
      })
      await w.find('#calendar-id').setValue('  eigene-eingabe  ')

      await w
        .findAll('button')
        .filter((b) => b.text() === 'Speichern')[0]
        ?.trigger('click')
      await flushPromises()

      expect((w.find('#calendar-id').element as HTMLInputElement).value).toBe(
        'vom-server@group.calendar.google.com',
      )
    })

    it('says what could not be loaded', async () => {
      mockListHints.mockRejectedValueOnce(new Error('offline'))
      const w = await mountView()

      expect(w.text()).toContain('Programm-Daten konnten nicht geladen werden.')
    })

    it('names the move buttons after their hint', async () => {
      const w = await mountView()

      expect(w.find('button[aria-label="Nach unten verschieben: Erster Hinweis."]').exists()).toBe(
        true,
      )
      expect(w.find('button[aria-label="Nach oben verschieben: Zweiter Hinweis."]').exists()).toBe(
        true,
      )
    })
  })
})
