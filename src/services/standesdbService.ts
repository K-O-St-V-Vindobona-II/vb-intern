import api from './api'
import type {
  Stats,
  ReferenceData,
  RolesListResponse,
  ExportConfig,
  ExportRequestPayload,
  KeysListResponse,
  MemberDetail,
  MemberDismissed,
  MemberSelfServiceDetail,
  MemberSelfServiceFormData,
  MyChangeRequest,
  MemberChangeRequestSummary,
  MemberChangeRequestDetail,
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

  downloadExport(data: ExportRequestPayload) {
    return api.post<Blob>('/standesdb/export', data, {
      responseType: 'blob',
    })
  },

  getKeysList() {
    return api.get<KeysListResponse>('/standesdb/keys')
  },

  downloadKeysList() {
    return api.get<Blob>('/standesdb/keys/download', {
      responseType: 'blob',
    })
  },

  getReferenceData() {
    return api.get<ReferenceData>('/standesdb/reference-data')
  },

  getMember(id: string) {
    return api.get<MemberDetail | MemberDismissed>(`/standesdb/members/${encodeURIComponent(id)}`)
  },

  createMember(data: Record<string, unknown>) {
    return api.post('/standesdb/members', data)
  },

  updateMember(id: string, data: Record<string, unknown>) {
    return api.put(`/standesdb/members/${encodeURIComponent(id)}`, data)
  },

  searchParent(memberId: string, q: string) {
    return api.get<{
      data: { id: string; cn: string }[]
    }>(`/standesdb/members/${encodeURIComponent(memberId)}/searchparent`, {
      params: { q },
    })
  },

  getMySelfServiceData() {
    return api.get<MemberSelfServiceDetail>('/standesdb/members/me/stammdaten')
  },

  getMyChangeRequest() {
    return api.get<MyChangeRequest>('/standesdb/members/me/change-request')
  },

  submitMyChangeRequest(data: MemberSelfServiceFormData) {
    return api.post<{ status: string }>('/standesdb/members/me/change-request', data)
  },

  listChangeRequests() {
    return api.get<{ items: MemberChangeRequestSummary[]; total: number }>(
      '/standesdb/member-change-requests',
    )
  },

  getChangeRequest(id: string) {
    return api.get<MemberChangeRequestDetail>(
      `/standesdb/member-change-requests/${encodeURIComponent(id)}`,
    )
  },

  // expectedUpdatedAt is the updated_at of the request as the reviewer saw it;
  // the API refuses the decision when the member has changed the request since.
  decideChangeRequest(
    id: string,
    fieldDecisions: Record<string, 'approved' | 'rejected'>,
    expectedUpdatedAt: string,
  ) {
    return api.post<{ status: string }>(
      `/standesdb/member-change-requests/${encodeURIComponent(id)}/decide`,
      {
        field_decisions: fieldDecisions,
        expected_updated_at: expectedUpdatedAt,
      },
    )
  },

  getContact(id: string) {
    return api.get<ContactDetail>(`/standesdb/contacts/${encodeURIComponent(id)}`)
  },

  createContact(data: Record<string, unknown>) {
    return api.post('/standesdb/contacts', data)
  },

  updateContact(id: string, data: Record<string, unknown>) {
    return api.put(`/standesdb/contacts/${encodeURIComponent(id)}`, data)
  },

  deleteContact(id: string) {
    return api.delete(`/standesdb/contacts/${encodeURIComponent(id)}`)
  },

  getMemberAuthActivity(memberId: string) {
    return api.get<{
      auth_lastlogin: string | null
      auth_lastsignal: string | null
      auth_lastlogout: string | null
    }>(`/standesdb/members/${encodeURIComponent(memberId)}/auth-activity`)
  },

  getChangelog(
    type: 'member' | 'contact',
    id: string,
    params: { page?: number; page_size?: number } = {},
  ) {
    const segment = type === 'member' ? 'members' : 'contacts'
    return api.get<{
      items: {
        id: string
        modified_at: string | null
        modified_by_name: string | null
        action: string
        key: string
        old: string | null
        new: string | null
      }[]
      total: number
      page: number
      page_size: number
    }>(`/standesdb/${segment}/${encodeURIComponent(id)}/changelog`, { params })
  },

  getMemberImages(memberId: string) {
    return api.get<{
      owner: ImageOwnerRef
      images: StandesdbImage[]
    }>(`/standesdb/members/${encodeURIComponent(memberId)}/images`)
  },

  getContactImages(contactId: string) {
    return api.get<{
      owner: ImageOwnerRef
      images: StandesdbImage[]
    }>(`/standesdb/contacts/${encodeURIComponent(contactId)}/images`)
  },

  uploadImage(ownerType: string, ownerId: string, file: File, description: string | null) {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    const plural = ownerType === 'member' ? 'members' : 'contacts'
    return api.post(`/standesdb/${plural}/${encodeURIComponent(ownerId)}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  updateImage(
    ownerType: string,
    ownerId: string,
    imageId: string,
    data: { description: string | null; default: boolean },
  ) {
    const plural = ownerType === 'member' ? 'members' : 'contacts'
    return api.put(
      `/standesdb/${plural}/${encodeURIComponent(ownerId)}/images/${encodeURIComponent(imageId)}`,
      data,
    )
  },

  deleteImage(ownerType: string, ownerId: string, imageId: string) {
    const plural = ownerType === 'member' ? 'members' : 'contacts'
    return api.delete(
      `/standesdb/${plural}/${encodeURIComponent(ownerId)}/images/${encodeURIComponent(imageId)}`,
    )
  },

  getOwnImages() {
    return api.get<{
      owner: ImageOwnerRef
      images: StandesdbImage[]
    }>('/standesdb/members/me/images')
  },

  uploadOwnImage(file: File, description: string | null) {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    return api.post('/standesdb/members/me/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  updateOwnImage(imageId: string, data: { description: string | null; default: boolean }) {
    return api.put(`/standesdb/members/me/images/${encodeURIComponent(imageId)}`, data)
  },

  deleteOwnImage(imageId: string) {
    return api.delete(`/standesdb/members/me/images/${encodeURIComponent(imageId)}`)
  },

  getImageUrl(ownerType: string, ownerId: string, imageId: string, thumb = false) {
    const plural = ownerType === 'member' ? 'members' : 'contacts'
    return api.get<{ url: string }>(
      `/standesdb/${plural}/${encodeURIComponent(ownerId)}/images/${encodeURIComponent(imageId)}/url`,
      {
        params: thumb ? { thumb: true } : undefined,
      },
    )
  },
}
