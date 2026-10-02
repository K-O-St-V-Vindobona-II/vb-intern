import { siteSettingsService } from '@/services/publicContentService'
import type { SiteSettingsResponse } from '@/services/publicContentService'

/** The fields of the public-site settings that an admin view can change. */
export interface SiteSettingsChanges {
  videoHeading?: string
  youtubeUrl?: string
  calendarId?: string
  galleryHeading?: string
}

export const youtubeWatchUrl = (youtubeId: string): string =>
  `https://www.youtube.com/watch?v=${youtubeId}`

/**
 * Saves the given fields on top of the settings as they are stored right now.
 *
 * The API replaces all four settings with one request, and three admin views
 * each own one or two of them. Sending the copy a view loaded when it was
 * opened would silently revert whatever another view or administrator changed
 * in the meantime, so the other fields are read again just before the write.
 */
export async function saveSiteSettings(
  changes: SiteSettingsChanges,
): Promise<SiteSettingsResponse> {
  const { data: current } = await siteSettingsService.getSettings()
  const { data: saved } = await siteSettingsService.updateSettings({
    about_video_heading: changes.videoHeading ?? current.about_video_heading,
    youtube_url: changes.youtubeUrl ?? youtubeWatchUrl(current.about_video_youtube_id),
    calendar_id: changes.calendarId ?? current.programm_calendar_id,
    gallery_heading: changes.galleryHeading ?? current.gallery_heading,
  })
  return saved
}
