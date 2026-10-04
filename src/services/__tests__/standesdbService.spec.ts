import { describe, it, expect, vi, beforeEach } from 'vitest'
import standesdbService from '@/services/standesdbService'
import type { MemberSelfServiceFormData } from '@/types/standesdb'

function buildSelfServicePayload(
  overrides: Partial<MemberSelfServiceFormData> = {},
): MemberSelfServiceFormData {
  return {
    vortitel: null,
    vorname: null,
    nachname: 'Neu',
    nachname_geburt: null,
    nachtitel: null,
    couleurname: null,
    email: null,
    url: null,
    mkv_ogv_url: null,
    rufnummer_mobil: null,
    rufnummer_privat: null,
    rufnummer_beruf: null,
    zustellungen: 'deaktiviert',
    adresse_privat_anschrift: null,
    adresse_privat_plz: null,
    adresse_privat_ort: null,
    adresse_privat_land: null,
    adresse_beruf_anschrift: null,
    adresse_beruf_plz: null,
    adresse_beruf_ort: null,
    adresse_beruf_land: null,
    arbeitgeber: null,
    taetigkeit: null,
    mitgliedschaften: null,
    verbandchargen: null,
    ...overrides,
  }
}

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
    const data = {
      module: 'mailing-liste',
      selections: { vbw_fu: true },
      include_disabled_delivery: false,
      include_dead: false,
      include_common_contacts: false,
      only_without_email: false,
    }
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

  it('getMySelfServiceData fetches the own live Stammdaten', () => {
    standesdbService.getMySelfServiceData()
    expect(mockGet).toHaveBeenCalledWith('/standesdb/members/me/stammdaten')
  })

  it('getMyChangeRequest fetches the own pending change request', () => {
    standesdbService.getMyChangeRequest()
    expect(mockGet).toHaveBeenCalledWith('/standesdb/members/me/change-request')
  })

  it('submitMyChangeRequest posts the self-service form payload', () => {
    const data = buildSelfServicePayload()
    standesdbService.submitMyChangeRequest(data)
    expect(mockPost).toHaveBeenCalledWith('/standesdb/members/me/change-request', data)
  })

  it('listChangeRequests fetches the org-scoped pending list', () => {
    standesdbService.listChangeRequests()
    expect(mockGet).toHaveBeenCalledWith('/standesdb/member-change-requests')
  })

  it('getChangeRequest fetches a single change request with its diff', () => {
    standesdbService.getChangeRequest('11111111-1111-1111-1111-111111111111')
    expect(mockGet).toHaveBeenCalledWith(
      '/standesdb/member-change-requests/11111111-1111-1111-1111-111111111111',
    )
  })

  it('decideChangeRequest posts the field decisions and the reviewed version', () => {
    standesdbService.decideChangeRequest(
      '11111111-1111-1111-1111-111111111111',
      { nachname: 'approved' },
      '2026-08-06T10:00:00.123456Z',
    )
    expect(mockPost).toHaveBeenCalledWith(
      '/standesdb/member-change-requests/11111111-1111-1111-1111-111111111111/decide',
      {
        field_decisions: { nachname: 'approved' },
        expected_updated_at: '2026-08-06T10:00:00.123456Z',
      },
    )
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
    standesdbService.updateImage('member', 1, 'image-uuid-5', { description: 'neu', default: true })
    expect(mockPut).toHaveBeenCalledWith('/standesdb/members/1/images/image-uuid-5', {
      description: 'neu',
      default: true,
    })
  })

  it('updateImage puts the updated image metadata for a contact', () => {
    standesdbService.updateImage('contact', 2, 'image-uuid-5', {
      description: 'neu',
      default: false,
    })
    expect(mockPut).toHaveBeenCalledWith('/standesdb/contacts/2/images/image-uuid-5', {
      description: 'neu',
      default: false,
    })
  })

  it('deleteImage deletes the image for a member', () => {
    standesdbService.deleteImage('member', 1, 'image-uuid-5')
    expect(mockDelete).toHaveBeenCalledWith('/standesdb/members/1/images/image-uuid-5')
  })

  it('deleteImage deletes the image for a contact', () => {
    standesdbService.deleteImage('contact', 2, 'image-uuid-5')
    expect(mockDelete).toHaveBeenCalledWith('/standesdb/contacts/2/images/image-uuid-5')
  })

  it('getImageUrl without thumb omits the thumb param', () => {
    standesdbService.getImageUrl('member', 1, 'image-uuid-5')
    expect(mockGet).toHaveBeenCalledWith('/standesdb/members/1/images/image-uuid-5/url', {
      params: undefined,
    })
  })

  it('getImageUrl with thumb=true forwards the thumb param', () => {
    standesdbService.getImageUrl('contact', 2, 'image-uuid-5', true)
    expect(mockGet).toHaveBeenCalledWith('/standesdb/contacts/2/images/image-uuid-5/url', {
      params: { thumb: true },
    })
  })

  describe('identifiers in request paths', () => {
    const TRAVERSAL = '../../auth/sessions'
    const ENCODED = '..%2F..%2Fauth%2Fsessions'

    it.each([
      [
        'getMember',
        () => standesdbService.getMember(TRAVERSAL),
        mockGet,
        `/standesdb/members/${ENCODED}`,
      ],
      [
        'updateMember',
        () => standesdbService.updateMember(TRAVERSAL, {}),
        mockPut,
        `/standesdb/members/${ENCODED}`,
      ],
      [
        'getChangeRequest',
        () => standesdbService.getChangeRequest(TRAVERSAL),
        mockGet,
        `/standesdb/member-change-requests/${ENCODED}`,
      ],
      [
        'decideChangeRequest',
        () => standesdbService.decideChangeRequest(TRAVERSAL, {}, '2026-08-06T10:00:00Z'),
        mockPost,
        `/standesdb/member-change-requests/${ENCODED}/decide`,
      ],
      [
        'getContact',
        () => standesdbService.getContact(TRAVERSAL),
        mockGet,
        `/standesdb/contacts/${ENCODED}`,
      ],
      [
        'updateContact',
        () => standesdbService.updateContact(TRAVERSAL, {}),
        mockPut,
        `/standesdb/contacts/${ENCODED}`,
      ],
      [
        'deleteContact',
        () => standesdbService.deleteContact(TRAVERSAL),
        mockDelete,
        `/standesdb/contacts/${ENCODED}`,
      ],
      [
        'getChangelog',
        () => standesdbService.getChangelog('contact', TRAVERSAL),
        mockGet,
        `/standesdb/contacts/${ENCODED}/changelog`,
      ],
      [
        'getMemberImages',
        () => standesdbService.getMemberImages(TRAVERSAL),
        mockGet,
        `/standesdb/members/${ENCODED}/images`,
      ],
      [
        'getContactImages',
        () => standesdbService.getContactImages(TRAVERSAL),
        mockGet,
        `/standesdb/contacts/${ENCODED}/images`,
      ],
      [
        'updateImage',
        () =>
          standesdbService.updateImage('member', TRAVERSAL, '../x', {
            description: null,
            default: false,
          }),
        mockPut,
        `/standesdb/members/${ENCODED}/images/..%2Fx`,
      ],
      [
        'deleteImage',
        () => standesdbService.deleteImage('contact', TRAVERSAL, '../x'),
        mockDelete,
        `/standesdb/contacts/${ENCODED}/images/..%2Fx`,
      ],
      [
        'deleteOwnImage',
        () => standesdbService.deleteOwnImage('../x'),
        mockDelete,
        '/standesdb/members/me/images/..%2Fx',
      ],
      [
        'getImageUrl',
        () => standesdbService.getImageUrl('member', TRAVERSAL, '../x'),
        mockGet,
        `/standesdb/members/${ENCODED}/images/..%2Fx/url`,
      ],
      [
        'searchParent',
        () => standesdbService.searchParent(TRAVERSAL, 'Muster'),
        mockGet,
        `/standesdb/members/${ENCODED}/searchparent`,
      ],
      [
        'getMemberAuthActivity',
        () => standesdbService.getMemberAuthActivity(TRAVERSAL),
        mockGet,
        `/standesdb/members/${ENCODED}/auth-activity`,
      ],
      [
        'uploadImage',
        () => standesdbService.uploadImage('member', TRAVERSAL, new File(['x'], 'a.jpg'), null),
        mockPost,
        `/standesdb/members/${ENCODED}/images`,
      ],
      [
        'updateOwnImage',
        () => standesdbService.updateOwnImage('../x', { description: null, default: false }),
        mockPut,
        '/standesdb/members/me/images/..%2Fx',
      ],
    ])('%s keeps an identifier from turning into extra path segments', (_name, call, mock, url) => {
      call()

      expect(mock.mock.calls[0]![0]).toBe(url)
    })
  })
})
