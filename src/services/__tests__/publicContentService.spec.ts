import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  aboutTabsService,
  siteSettingsService,
  programmHintsService,
  quotesService,
  socialLinksService,
} from '@/services/publicContentService'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()
vi.mock('@/services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

const PREFIX = '/public-content-admin'

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
  mockPut.mockReset()
  mockDelete.mockReset()
})

describe('aboutTabsService', () => {
  it('listTabs fetches the about-tabs list', () => {
    aboutTabsService.listTabs()
    expect(mockGet).toHaveBeenCalledWith(`${PREFIX}/about-tabs`)
  })

  it('updateTab puts to the given slot', () => {
    aboutTabsService.updateTab('mkv', { title: 'MKV', body: 'Text' })
    expect(mockPut).toHaveBeenCalledWith(`${PREFIX}/about-tabs/mkv`, {
      title: 'MKV',
      body: 'Text',
    })
  })
})

describe('siteSettingsService', () => {
  it('getSettings fetches the settings', () => {
    siteSettingsService.getSettings()
    expect(mockGet).toHaveBeenCalledWith(`${PREFIX}/settings`)
  })

  it('updateSettings puts the new values', () => {
    const data = {
      about_video_heading: 'Titel',
      youtube_url: 'https://youtu.be/abcdefghijk',
      calendar_id: 'abc@group.calendar.google.com',
    }
    siteSettingsService.updateSettings(data)
    expect(mockPut).toHaveBeenCalledWith(`${PREFIX}/settings`, data)
  })
})

describe('programmHintsService', () => {
  it('list fetches all hints', () => {
    programmHintsService.list()
    expect(mockGet).toHaveBeenCalledWith(`${PREFIX}/programm-hints`)
  })

  it('create posts a new hint', () => {
    programmHintsService.create({ text: 'Neuer Hinweis' })
    expect(mockPost).toHaveBeenCalledWith(`${PREFIX}/programm-hints`, {
      text: 'Neuer Hinweis',
    })
  })

  it('update puts the changed text', () => {
    programmHintsService.update(1, { text: 'Geändert' })
    expect(mockPut).toHaveBeenCalledWith(`${PREFIX}/programm-hints/1`, {
      text: 'Geändert',
    })
  })

  it('move posts the direction', () => {
    programmHintsService.move(1, 'down')
    expect(mockPost).toHaveBeenCalledWith(`${PREFIX}/programm-hints/1/move`, {
      direction: 'down',
    })
  })

  it('remove sends a DELETE request', () => {
    programmHintsService.remove(1)
    expect(mockDelete).toHaveBeenCalledWith(`${PREFIX}/programm-hints/1`)
  })
})

describe('quotesService', () => {
  it('list fetches all quotes', () => {
    quotesService.list()
    expect(mockGet).toHaveBeenCalledWith(`${PREFIX}/quotes`)
  })

  it('create posts a new quote', () => {
    quotesService.create({ quote: 'Ein Zitat', author: 'Jemand' })
    expect(mockPost).toHaveBeenCalledWith(`${PREFIX}/quotes`, {
      quote: 'Ein Zitat',
      author: 'Jemand',
    })
  })

  it('update puts the changed quote', () => {
    quotesService.update(2, { quote: 'Geändert', author: 'Jemand' })
    expect(mockPut).toHaveBeenCalledWith(`${PREFIX}/quotes/2`, {
      quote: 'Geändert',
      author: 'Jemand',
    })
  })

  it('move posts the direction', () => {
    quotesService.move(2, 'up')
    expect(mockPost).toHaveBeenCalledWith(`${PREFIX}/quotes/2/move`, {
      direction: 'up',
    })
  })

  it('remove sends a DELETE request', () => {
    quotesService.remove(2)
    expect(mockDelete).toHaveBeenCalledWith(`${PREFIX}/quotes/2`)
  })
})

describe('socialLinksService', () => {
  it('list fetches all links', () => {
    socialLinksService.list()
    expect(mockGet).toHaveBeenCalledWith(`${PREFIX}/social-links`)
  })

  it('create posts a new link', () => {
    socialLinksService.create({
      platform: 'linkedin',
      label: 'LinkedIn',
      url: 'https://linkedin.com/company/vindobona2',
      is_enabled: true,
    })
    expect(mockPost).toHaveBeenCalledWith(`${PREFIX}/social-links`, {
      platform: 'linkedin',
      label: 'LinkedIn',
      url: 'https://linkedin.com/company/vindobona2',
      is_enabled: true,
    })
  })

  it('update puts label/url/is_enabled without platform', () => {
    socialLinksService.update(3, {
      label: 'Instagram',
      url: 'https://www.instagram.com/vindobona2',
      is_enabled: false,
    })
    expect(mockPut).toHaveBeenCalledWith(`${PREFIX}/social-links/3`, {
      label: 'Instagram',
      url: 'https://www.instagram.com/vindobona2',
      is_enabled: false,
    })
  })

  it('move posts the direction', () => {
    socialLinksService.move(3, 'down')
    expect(mockPost).toHaveBeenCalledWith(`${PREFIX}/social-links/3/move`, {
      direction: 'down',
    })
  })

  it('remove sends a DELETE request', () => {
    socialLinksService.remove(3)
    expect(mockDelete).toHaveBeenCalledWith(`${PREFIX}/social-links/3`)
  })
})
