import { describe, it, expect, vi, beforeEach } from 'vitest'
import standesdbService from '@/services/standesdbService'

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

describe('standesdbService', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
  })

  it('getStats fetches /standesdb/stats', () => {
    standesdbService.getStats()
    expect(mockGet).toHaveBeenCalledWith('/standesdb/stats')
  })

  it('search forwards the query param', () => {
    standesdbService.search('Mustermann')
    expect(mockGet).toHaveBeenCalledWith('/standesdb/search', { params: { q: 'Mustermann' } })
  })

  it('getRolesList forwards year/semester params', () => {
    standesdbService.getRolesList({ year: 2026, semester: 'SS' })
    expect(mockGet).toHaveBeenCalledWith('/standesdb/roles', {
      params: { year: 2026, semester: 'SS' },
    })
  })

  it('getRolesList works without params', () => {
    standesdbService.getRolesList()
    expect(mockGet).toHaveBeenCalledWith('/standesdb/roles', { params: undefined })
  })

  it('getExportConfig fetches /standesdb/export/config', () => {
    standesdbService.getExportConfig()
    expect(mockGet).toHaveBeenCalledWith('/standesdb/export/config')
  })

  it('downloadExport posts the config and requests a blob', () => {
    const data = { modules: ['members'] }
    standesdbService.downloadExport(data)
    expect(mockPost).toHaveBeenCalledWith('/standesdb/export', data, { responseType: 'blob' })
  })

  it('getKeysList fetches /standesdb/keys', () => {
    standesdbService.getKeysList()
    expect(mockGet).toHaveBeenCalledWith('/standesdb/keys')
  })

  it('downloadKeysList requests a blob', () => {
    standesdbService.downloadKeysList()
    expect(mockGet).toHaveBeenCalledWith('/standesdb/keys/download', { responseType: 'blob' })
  })

  it('getReferenceData fetches /standesdb/reference-data', () => {
    standesdbService.getReferenceData()
    expect(mockGet).toHaveBeenCalledWith('/standesdb/reference-data')
  })

  it('getMember fetches a single member', () => {
    standesdbService.getMember(1)
    expect(mockGet).toHaveBeenCalledWith('/standesdb/members/1')
  })

  it('createMember posts the new member payload', () => {
    const data = { vorname: 'Max' }
    standesdbService.createMember(data)
    expect(mockPost).toHaveBeenCalledWith('/standesdb/members', data)
  })

  it('updateMember puts the updated member payload', () => {
    const data = { vorname: 'Max' }
    standesdbService.updateMember(1, data)
    expect(mockPut).toHaveBeenCalledWith('/standesdb/members/1', data)
  })

  it('searchParent forwards the member id and query', () => {
    standesdbService.searchParent(1, 'Schmidt')
    expect(mockGet).toHaveBeenCalledWith('/standesdb/members/1/searchparent', {
      params: { q: 'Schmidt' },
    })
  })

  it('getContact fetches a single contact', () => {
    standesdbService.getContact(2)
    expect(mockGet).toHaveBeenCalledWith('/standesdb/contacts/2')
  })

  it('createContact posts the new contact payload', () => {
    const data = { name: 'Firma GmbH' }
    standesdbService.createContact(data)
    expect(mockPost).toHaveBeenCalledWith('/standesdb/contacts', data)
  })

  it('updateContact puts the updated contact payload', () => {
    const data = { name: 'Firma GmbH' }
    standesdbService.updateContact(2, data)
    expect(mockPut).toHaveBeenCalledWith('/standesdb/contacts/2', data)
  })

  it('deleteContact deletes the contact', () => {
    standesdbService.deleteContact(2)
    expect(mockDelete).toHaveBeenCalledWith('/standesdb/contacts/2')
  })

  it('getMemberAuthActivity fetches the auth activity timestamps', () => {
    standesdbService.getMemberAuthActivity(1)
    expect(mockGet).toHaveBeenCalledWith('/standesdb/members/1/auth-activity')
  })

  it('getChangelog builds the members segment', () => {
    standesdbService.getChangelog('member', 1)
    expect(mockGet).toHaveBeenCalledWith('/standesdb/members/1/changelog', { params: {} })
  })

  it('getChangelog builds the contacts segment', () => {
    standesdbService.getChangelog('contact', 2)
    expect(mockGet).toHaveBeenCalledWith('/standesdb/contacts/2/changelog', { params: {} })
  })

  it('getChangelog forwards pagination params', () => {
    standesdbService.getChangelog('member', 1, { page: 2, page_size: 10 })
    expect(mockGet).toHaveBeenCalledWith('/standesdb/members/1/changelog', {
      params: { page: 2, page_size: 10 },
    })
  })

  it('getMemberImages fetches the member image gallery', () => {
    standesdbService.getMemberImages(1)
    expect(mockGet).toHaveBeenCalledWith('/standesdb/members/1/images')
  })

  it('getContactImages fetches the contact image gallery', () => {
    standesdbService.getContactImages(2)
    expect(mockGet).toHaveBeenCalledWith('/standesdb/contacts/2/images')
  })

  it('uploadImage sends a multipart form with file and description for a member', () => {
    const file = new File(['x'], 'pic.jpg')
    standesdbService.uploadImage('member', 1, file, 'Profilbild')

    expect(mockPost).toHaveBeenCalledWith('/standesdb/members/1/images', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const formData = mockPost.mock.calls[0][1] as FormData
    expect(formData.get('file')).toBe(file)
    expect(formData.get('description')).toBe('Profilbild')
  })

  it('uploadImage omits the description field when null, for a contact', () => {
    const file = new File(['x'], 'pic.jpg')
    standesdbService.uploadImage('contact', 2, file, null)

    expect(mockPost).toHaveBeenCalledWith('/standesdb/contacts/2/images', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const formData = mockPost.mock.calls[0][1] as FormData
    expect(formData.get('description')).toBeNull()
  })

  it('updateImage puts the updated image metadata for a member', () => {
    standesdbService.updateImage('member', 1, 5, { description: 'neu', default: true })
    expect(mockPut).toHaveBeenCalledWith('/standesdb/members/1/images/5', {
      description: 'neu',
      default: true,
    })
  })

  it('updateImage puts the updated image metadata for a contact', () => {
    standesdbService.updateImage('contact', 2, 5, { description: 'neu', default: false })
    expect(mockPut).toHaveBeenCalledWith('/standesdb/contacts/2/images/5', {
      description: 'neu',
      default: false,
    })
  })

  it('deleteImage deletes the image for a member', () => {
    standesdbService.deleteImage('member', 1, 5)
    expect(mockDelete).toHaveBeenCalledWith('/standesdb/members/1/images/5')
  })

  it('deleteImage deletes the image for a contact', () => {
    standesdbService.deleteImage('contact', 2, 5)
    expect(mockDelete).toHaveBeenCalledWith('/standesdb/contacts/2/images/5')
  })

  it('getImageUrl without thumb omits the thumb param', () => {
    standesdbService.getImageUrl('member', 1, 5)
    expect(mockGet).toHaveBeenCalledWith('/standesdb/members/1/images/5/url', { params: undefined })
  })

  it('getImageUrl with thumb=true forwards the thumb param', () => {
    standesdbService.getImageUrl('contact', 2, 5, true)
    expect(mockGet).toHaveBeenCalledWith('/standesdb/contacts/2/images/5/url', {
      params: { thumb: true },
    })
  })
})
