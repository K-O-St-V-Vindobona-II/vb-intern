import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import VideoAdminView from '../VideoAdminView.vue'

const baseSettings = {
  about_video_heading: 'Erfahre mehr über den MKV',
  about_video_youtube_id: 'Sh51ebB2G8A',
  programm_calendar_id: 'abc@group.calendar.google.com',
  gallery_heading: 'Eindrücke',
}

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
    mockGetSettings.mockReset().mockResolvedValue({ data: { ...baseSettings } })
    mockUpdateSettings.mockReset().mockResolvedValue({ data: { ...baseSettings } })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const mountView = async () => {
    wrapper = mount(VideoAdminView, {
      global: { plugins: [PrimeVue, ToastService, createPinia()] },
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
})
