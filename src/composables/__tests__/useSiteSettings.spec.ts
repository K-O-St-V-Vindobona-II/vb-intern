import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveSiteSettings, youtubeWatchUrl } from '@/composables/useSiteSettings'

const mockGetSettings = vi.fn()
const mockUpdateSettings = vi.fn()
vi.mock('@/services/publicContentService', () => ({
  siteSettingsService: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
    updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
  },
}))

const stored = {
  about_video_heading: 'Erfahre mehr',
  about_video_youtube_id: 'Sh51ebB2G8A',
  programm_calendar_id: 'abc@group.calendar.google.com',
  gallery_heading: 'Eindrücke',
}

describe('saveSiteSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue({ data: { ...stored } })
    mockUpdateSettings.mockImplementation((body) => Promise.resolve({ data: body }))
  })

  it('builds the watch link of a stored video id', () => {
    expect(youtubeWatchUrl('Sh51ebB2G8A')).toBe('https://www.youtube.com/watch?v=Sh51ebB2G8A')
  })

  it('writes the changed field and keeps the three others as they are stored', async () => {
    await saveSiteSettings({ galleryHeading: 'Bildergalerie' })

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      about_video_heading: 'Erfahre mehr',
      youtube_url: 'https://www.youtube.com/watch?v=Sh51ebB2G8A',
      calendar_id: 'abc@group.calendar.google.com',
      gallery_heading: 'Bildergalerie',
    })
  })

  it('takes the other fields from a fresh read, not from what a view loaded earlier', async () => {
    mockGetSettings.mockResolvedValue({
      data: { ...stored, programm_calendar_id: 'changed-elsewhere@group.calendar.google.com' },
    })

    await saveSiteSettings({ videoHeading: 'Neu' })

    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        about_video_heading: 'Neu',
        calendar_id: 'changed-elsewhere@group.calendar.google.com',
      }),
    )
  })

  it('reads before it writes', async () => {
    await saveSiteSettings({ calendarId: 'new@group.calendar.google.com' })

    expect(mockGetSettings.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpdateSettings.mock.invocationCallOrder[0]!,
    )
  })

  it('returns the settings the API answered with', async () => {
    const answered = { ...stored, gallery_heading: 'Vom Server' }
    mockUpdateSettings.mockResolvedValue({ data: answered })

    const saved = await saveSiteSettings({ galleryHeading: 'x' })

    expect(saved).toEqual(answered)
  })

  it('does not write when the current settings cannot be read', async () => {
    mockGetSettings.mockRejectedValue(new Error('boom'))

    await expect(saveSiteSettings({ galleryHeading: 'x' })).rejects.toThrow('boom')
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })
})
