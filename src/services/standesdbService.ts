import api from './api'
import type {
  Stats,
  ReferenceData,
  RolesListResponse,
  ExportConfig,
  KeysListResponse,
  MemberDetail,
  MemberDismissed,
  ContactDetail,
  SearchResult,
  StandesdbImage,
  ImageOwnerRef,
} from '@/types/standesdb'

export default {
  getStats() {
    return api.get<Stats>('/standesdb/stats')
  },

  search(q: string) {
    return api.get<{ data: SearchResult[] }>('/standesdb/search', { params: { q } })
  },

  getRolesList(params?: { year: number; semester: string }) {
    return api.get<RolesListResponse>('/standesdb/roles', { params })
  },

  getExportConfig() {
    return api.get<ExportConfig>('/standesdb/export/config')
  },

  downloadExport(data: Record<string, unknown>) {
    return api.post('/standesdb/export', data, {
      responseType: 'blob',
    })
  },

  getKeysList() {
    return api.get<KeysListResponse>('/standesdb/keys')
  },

  downloadKeysList() {
    return api.get('/standesdb/keys/download', {
      responseType: 'blob',
    })
  },

  getReferenceData() {
    return api.get<ReferenceData>('/standesdb/reference-data')
  },

  getMember(id: number) {
    return api.get<MemberDetail | MemberDismissed>(`/standesdb/members/${id}`)
  },

  createMember(data: Record<string, unknown>) {
    return api.post('/standesdb/members', data)
  },

  updateMember(id: number, data: Record<string, unknown>) {
    return api.put(`/standesdb/members/${id}`, data)
  },

  searchParent(memberId: number, q: string) {
    return api.get<{
      data: { id: number; cn: string }[]
    }>(`/standesdb/members/${memberId}/searchparent`, {
      params: { q },
    })
  },

  getContact(id: number) {
    return api.get<ContactDetail>(`/standesdb/contacts/${id}`)
  },

  createContact(data: Record<string, unknown>) {
    return api.post('/standesdb/contacts', data)
  },

  updateContact(id: number, data: Record<string, unknown>) {
    return api.put(`/standesdb/contacts/${id}`, data)
  },

  deleteContact(id: number) {
    return api.delete(`/standesdb/contacts/${id}`)
  },

  getMemberAuthActivity(memberId: number) {
    return api.get<{
      auth_lastlogin: string | null
      auth_lastsignal: string | null
      auth_lastlogout: string | null
    }>(`/standesdb/members/${memberId}/auth-activity`)
  },

  getChangelog(type: 'member' | 'contact', id: number) {
    const segment = type === 'member' ? 'members' : 'contacts'
    return api.get<
      {
        id: number
        modified_at: string | null
        modified_by_name: string | null
        action: string
        key: string
        old: string | null
        new: string | null
      }[]
    >(`/standesdb/${segment}/${id}/changelog`)
  },

  getMemberImages(memberId: number) {
    return api.get<{
      owner: ImageOwnerRef
      images: StandesdbImage[]
    }>(`/standesdb/members/${memberId}/images`)
  },

  getContactImages(contactId: number) {
    return api.get<{
      owner: ImageOwnerRef
      images: StandesdbImage[]
    }>(`/standesdb/contacts/${contactId}/images`)
  },

  uploadImage(ownerType: string, ownerId: number, file: File, description: string | null) {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    const plural = ownerType === 'member' ? 'members' : 'contacts'
    return api.post(`/standesdb/${plural}/${ownerId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  updateImage(
    ownerType: string,
    ownerId: number,
    imageId: number,
    data: { description: string | null; default: boolean },
  ) {
    const plural = ownerType === 'member' ? 'members' : 'contacts'
    return api.put(`/standesdb/${plural}/${ownerId}/images/${imageId}`, data)
  },

  deleteImage(ownerType: string, ownerId: number, imageId: number) {
    const plural = ownerType === 'member' ? 'members' : 'contacts'
    return api.delete(`/standesdb/${plural}/${ownerId}/images/${imageId}`)
  },

  getImageUrl(ownerType: string, ownerId: number, imageId: number, thumb = false) {
    const plural = ownerType === 'member' ? 'members' : 'contacts'
    return api.get<{ url: string }>(`/standesdb/${plural}/${ownerId}/images/${imageId}/url`, {
      params: thumb ? { thumb: true } : undefined,
    })
  },
}
