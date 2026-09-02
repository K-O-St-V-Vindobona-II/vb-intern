import api from './api'
import type { DirDetail, FileDetail, FileShort, UploadConfig, Comment } from '@/types/archive'

export interface ArchiveSearchResult {
  type: 'file' | 'dir'
  id: string
  name: string | null
  description: string | null
  extension?: string | null
  is_image?: boolean
  path: string
}

export default {
  searchArchive(q: string) {
    return api.get<ArchiveSearchResult[]>('/archive/search', { params: { q } })
  },

  getDirRoot() {
    return api.get<DirDetail>('/archive/dirs')
  },

  getDirDetail(id: string) {
    return api.get<DirDetail>(`/archive/dirs/${id}`)
  },

  createDir(data: {
    name: string
    description?: string | null
    permissions: string[]
    recursive_permissions: boolean
    parentId?: string | null
  }) {
    return api.post('/archive/dirs', data)
  },

  updateDir(
    id: string,
    data: {
      name: string
      description?: string | null
      permissions: string[]
      recursive_permissions: boolean
    },
  ) {
    return api.put(`/archive/dirs/${id}`, data)
  },

  deleteDir(id: string) {
    return api.delete(`/archive/dirs/${id}`)
  },

  restoreDir(id: string) {
    return api.patch(`/archive/dirs/${id}/restore`)
  },

  purgeDir(id: string) {
    return api.delete(`/archive/dirs/${id}/purge`)
  },

  receiveItems(
    dirId: string,
    data: {
      type: string
      ids: string[]
      action: string
    },
  ) {
    return api.post(`/archive/dirs/${dirId}/receive`, data)
  },

  receiveItemsRoot(data: { type: string; ids: string[]; action: string }) {
    return api.post('/archive/dirs/receive', data)
  },

  getFileDetail(id: string) {
    return api.get<FileDetail>(`/archive/files/${id}`)
  },

  updateFile(id: string, data: { description?: string | null }) {
    return api.put(`/archive/files/${id}`, data)
  },

  deleteFile(id: string) {
    return api.delete(`/archive/files/${id}`)
  },

  restoreFile(id: string) {
    return api.patch(`/archive/files/${id}/restore`)
  },

  getFileUrl(id: string, size?: string) {
    const suffix = size ? `/${size}` : ''
    return api.get<{ url: string }>(`/archive/files/${id}/url${suffix}`)
  },

  createComment(fileId: string, data: { content: string }) {
    return api.post<{ comment: Comment }>(`/archive/files/${fileId}/comments`, data)
  },

  deleteComment(fileId: string, commentId: string) {
    return api.delete(`/archive/files/${fileId}/comments/${commentId}`)
  },

  getUploadConfig() {
    return api.get<UploadConfig>('/archive/upload/config')
  },

  getUnfiledUploads() {
    return api.get<{ files: FileShort[] }>('/archive/upload/unfiled')
  },

  uploadFile(file: File, description: string) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('description', description)
    return api.post('/archive/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}
