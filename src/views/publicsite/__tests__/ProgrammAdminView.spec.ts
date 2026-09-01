import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
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
      global: { plugins: [PrimeVue, ToastService, createPinia()] },
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
    const upButtons = w.findAll('button[aria-label="Nach oben verschieben"]')
    await upButtons[1]?.trigger('click')
    await flushPromises()

    expect(mockMoveHint).toHaveBeenCalledWith(SECOND_HINT_ID, 'up')
  })

  it('deletes a hint after confirming', async () => {
    const w = await mountView()
    const deleteButtons = w.findAll('button[aria-label="Löschen"]')
    await deleteButtons[0]?.trigger('click')
    await flushPromises()

    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Löschen',
    )
    confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockRemoveHint).toHaveBeenCalledWith(FIRST_HINT_ID)
  })
})
