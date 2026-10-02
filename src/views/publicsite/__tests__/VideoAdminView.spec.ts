import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import VideoAdminView from '../VideoAdminView.vue'

const baseSettings = {
  about_video_heading: 'Erfahre mehr über den MKV',
  about_video_youtube_id: 'Sh51ebB2G8A',
  programm_calendar_id: 'abc@group.calendar.google.com',
  gallery_heading: 'Eindrücke',
}

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockGetSettings = vi.fn()
const mockUpdateSettings = vi.fn()

vi.mock('@/services/publicContentService', () => ({
  siteSettingsService: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
    updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
  },
}))

describe('VideoAdminView', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    mockToastAdd.mockReset()
    mockGetSettings.mockReset().mockResolvedValue({ data: { ...baseSettings } })
    mockUpdateSettings.mockReset().mockResolvedValue({ data: { ...baseSettings } })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const mountView = async () => {
    wrapper = mount(VideoAdminView, {
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('renders the current heading and a watch-URL built from the stored id', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Video')

    const headingInput = w.find('#video-heading')
    expect((headingInput.element as HTMLInputElement).value).toBe('Erfahre mehr über den MKV')

    const urlInput = w.find('#video-url')
    expect((urlInput.element as HTMLInputElement).value).toBe(
      'https://www.youtube.com/watch?v=Sh51ebB2G8A',
    )
  })

  it('shows a live preview iframe using the stored video id', async () => {
    const w = await mountView()
    const iframe = w.find('iframe')
    expect(iframe.attributes('src')).toBe(
      'https://www.youtube.com/embed/Sh51ebB2G8A?wmode=transparent&autoplay=0',
    )
  })

  it('saves heading + youtube url, preserving the calendar id', async () => {
    const w = await mountView()
    await w.find('#video-heading').setValue('Neue Überschrift')
    await w.find('#video-url').setValue('https://youtu.be/newvideoid1')

    const saveButton = w.findAll('button').find((b) => b.text() === 'Speichern')
    await saveButton?.trigger('click')
    await flushPromises()

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      about_video_heading: 'Neue Überschrift',
      youtube_url: 'https://youtu.be/newvideoid1',
      calendar_id: 'abc@group.calendar.google.com',
      gallery_heading: 'Eindrücke',
    })
  })

  it('shows a toast and a retry button when the settings cannot be loaded', async () => {
    mockGetSettings.mockRejectedValueOnce({ response: { data: { detail: 'Serverfehler' } } })
    const w = await mountView()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Serverfehler' }),
    )
    expect(w.find('#video-heading').exists()).toBe(false)

    await w
      .findAll('button')
      .find((b) => b.text().includes('Erneut versuchen'))
      ?.trigger('click')
    await flushPromises()

    expect((w.find('#video-heading').element as HTMLInputElement).value).toBe(
      'Erfahre mehr über den MKV',
    )
  })

  it('regression: saves on top of the settings stored right now, not those loaded on opening', async () => {
    const w = await mountView()
    mockGetSettings.mockResolvedValue({
      data: {
        ...baseSettings,
        programm_calendar_id: 'changed-elsewhere@group.calendar.google.com',
        gallery_heading: 'Anderswo geändert',
      },
    })
    await w.find('#video-heading').setValue('  Neue Überschrift  ')

    await w
      .findAll('button')
      .find((b) => b.text() === 'Speichern')
      ?.trigger('click')
    await flushPromises()

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      about_video_heading: 'Neue Überschrift',
      youtube_url: 'https://www.youtube.com/watch?v=Sh51ebB2G8A',
      calendar_id: 'changed-elsewhere@group.calendar.google.com',
      gallery_heading: 'Anderswo geändert',
    })
  })

  it('updates the preview from the id the API extracted', async () => {
    mockUpdateSettings.mockResolvedValue({
      data: { ...baseSettings, about_video_youtube_id: 'newvideoid1' },
    })
    const w = await mountView()
    await w.find('#video-url').setValue('https://youtu.be/newvideoid1')

    await w
      .findAll('button')
      .find((b) => b.text() === 'Speichern')
      ?.trigger('click')
    await flushPromises()

    expect(w.find('iframe').attributes('src')).toContain('/embed/newvideoid1?')
    expect((w.find('#video-url').element as HTMLInputElement).value).toBe(
      'https://www.youtube.com/watch?v=newvideoid1',
    )
  })

  it('does not offer to save while the heading or the link is blank', async () => {
    const w = await mountView()
    const save = () => w.findAll('button').find((b) => b.text() === 'Speichern')

    await w.find('#video-heading').setValue('   ')
    expect(save()?.attributes('disabled')).toBeDefined()

    await w.find('#video-heading').setValue('Überschrift')
    await w.find('#video-url').setValue('')
    expect(save()?.attributes('disabled')).toBeDefined()
  })

  it('keeps the previous preview and shows a toast when saving fails', async () => {
    mockUpdateSettings.mockRejectedValue({
      response: { data: { detail: 'Kein gültiger YouTube-Link erkannt.' } },
    })
    const w = await mountView()
    await w.find('#video-url').setValue('nonsense')

    await w
      .findAll('button')
      .find((b) => b.text() === 'Speichern')
      ?.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Kein gültiger YouTube-Link erkannt.' }),
    )
    expect(w.find('iframe').attributes('src')).toContain('/embed/Sh51ebB2G8A?')
  })

  describe('server values, limits and load failure text', () => {
    it('shows the heading and the video as the API stored them after saving', async () => {
      const w = await mountView()
      mockUpdateSettings.mockResolvedValue({
        data: {
          ...baseSettings,
          about_video_heading: 'Vom Server übernommen',
          about_video_youtube_id: 'AAAAAAAAAAA',
        },
      })
      await w.find('#video-heading').setValue('  Eigene Eingabe  ')

      await w
        .findAll('button')
        .find((b) => b.text() === 'Speichern')
        ?.trigger('click')
      await flushPromises()

      expect((w.find('#video-heading').element as HTMLInputElement).value).toBe(
        'Vom Server übernommen',
      )
      expect((w.find('#video-url').element as HTMLInputElement).value).toBe(
        'https://www.youtube.com/watch?v=AAAAAAAAAAA',
      )
      expect(w.find('iframe').attributes('src')).toContain('/embed/AAAAAAAAAAA')
    })

    it('limits heading and link to what the API accepts', async () => {
      const w = await mountView()

      expect(w.find('#video-heading').attributes('maxlength')).toBe('200')
      expect(w.find('#video-url').attributes('maxlength')).toBe('500')
    })

    it('says what could not be loaded', async () => {
      mockGetSettings.mockRejectedValueOnce(new Error('offline'))
      const w = await mountView()

      expect(w.text()).toContain('Einstellungen konnten nicht geladen werden.')
    })
  })
})
