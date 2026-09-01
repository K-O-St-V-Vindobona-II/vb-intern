import api from '@/services/api'

export type AboutTabSlot = 'anfang' | 'mkv' | 'heute'

export interface AboutTabAdminResponse {
  slot: AboutTabSlot
  title: string
  body: string
}

export interface AboutTabUpdateRequest {
  title: string
  body: string
}

export interface SiteSettingsResponse {
  about_video_heading: string
  about_video_youtube_id: string
  programm_calendar_id: string
  gallery_heading: string
}

export interface SiteSettingsUpdateRequest {
  about_video_heading: string
  youtube_url: string
  calendar_id: string
  gallery_heading: string
}

export interface ProgrammHintResponse {
  id: number
  text: string
}

export interface ProgrammHintRequest {
  text: string
}

export interface QuoteResponse {
  id: number
  quote: string
  author: string
}

export interface QuoteRequest {
  quote: string
  author: string
}

export interface SocialLinkAdminResponse {
  id: string
  platform: string
  label: string
  url: string
  is_enabled: boolean
}

export interface SocialLinkCreateRequest {
  platform: string
  label: string
  url: string
  is_enabled: boolean
}

export interface SocialLinkUpdateRequest {
  label: string
  url: string
  is_enabled: boolean
}

export type MoveDirection = 'up' | 'down'

const ADMIN_PREFIX = '/public-content-admin'

export const aboutTabsService = {
  listTabs() {
    return api.get<AboutTabAdminResponse[]>(`${ADMIN_PREFIX}/about-tabs`)
  },

  updateTab(slot: AboutTabSlot, data: AboutTabUpdateRequest) {
    return api.put<AboutTabAdminResponse>(`${ADMIN_PREFIX}/about-tabs/${slot}`, data)
  },
}

export const siteSettingsService = {
  getSettings() {
    return api.get<SiteSettingsResponse>(`${ADMIN_PREFIX}/settings`)
  },

  updateSettings(data: SiteSettingsUpdateRequest) {
    return api.put<SiteSettingsResponse>(`${ADMIN_PREFIX}/settings`, data)
  },
}

export const programmHintsService = {
  list() {
    return api.get<ProgrammHintResponse[]>(`${ADMIN_PREFIX}/programm-hints`)
  },

  create(data: ProgrammHintRequest) {
    return api.post<ProgrammHintResponse>(`${ADMIN_PREFIX}/programm-hints`, data)
  },

  update(hintId: number, data: ProgrammHintRequest) {
    return api.put<ProgrammHintResponse>(`${ADMIN_PREFIX}/programm-hints/${hintId}`, data)
  },

  move(hintId: number, direction: MoveDirection) {
    return api.post(`${ADMIN_PREFIX}/programm-hints/${hintId}/move`, { direction })
  },

  remove(hintId: number) {
    return api.delete(`${ADMIN_PREFIX}/programm-hints/${hintId}`)
  },
}

export const quotesService = {
  list() {
    return api.get<QuoteResponse[]>(`${ADMIN_PREFIX}/quotes`)
  },

  create(data: QuoteRequest) {
    return api.post<QuoteResponse>(`${ADMIN_PREFIX}/quotes`, data)
  },

  update(quoteId: number, data: QuoteRequest) {
    return api.put<QuoteResponse>(`${ADMIN_PREFIX}/quotes/${quoteId}`, data)
  },

  move(quoteId: number, direction: MoveDirection) {
    return api.post(`${ADMIN_PREFIX}/quotes/${quoteId}/move`, { direction })
  },

  remove(quoteId: number) {
    return api.delete(`${ADMIN_PREFIX}/quotes/${quoteId}`)
  },
}

export const socialLinksService = {
  list() {
    return api.get<SocialLinkAdminResponse[]>(`${ADMIN_PREFIX}/social-links`)
  },

  create(data: SocialLinkCreateRequest) {
    return api.post<SocialLinkAdminResponse>(`${ADMIN_PREFIX}/social-links`, data)
  },

  update(linkId: string, data: SocialLinkUpdateRequest) {
    return api.put<SocialLinkAdminResponse>(`${ADMIN_PREFIX}/social-links/${linkId}`, data)
  },

  move(linkId: string, direction: MoveDirection) {
    return api.post(`${ADMIN_PREFIX}/social-links/${linkId}/move`, { direction })
  },

  remove(linkId: string) {
    return api.delete(`${ADMIN_PREFIX}/social-links/${linkId}`)
  },
}
