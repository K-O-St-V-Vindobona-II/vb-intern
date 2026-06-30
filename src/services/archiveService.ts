import api from './api'
import type { DirDetail, FileDetail, FileShort, UploadConfig, Comment } from '@/types/archive'

export interface ArchiveSearchResult {
  type: 'file' | 'dir'
  id: number
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

  getDirDetail(id: number) {
    return api.get<DirDetail>(`/archive/dirs/${id}`)
  },

  createDir(data: {
    name: string
    description?: string | null
    permissions: string[]
    recursive_permissions: boolean
    parentId?: number | null
  }) {
    return api.post('/archive/dirs', data)
  },

  updateDir(
    id: number,
    data: {
      name: string
      description?: string | null
      permissions: string[]
      recursive_permissions: boolean
    },
  ) {
    return api.put(`/archive/dirs/${id}`, data)
  },

  deleteDir(id: number) {
    return api.delete(`/archive/dirs/${id}`)
  },

  restoreDir(id: number) {
    return api.patch(`/archive/dirs/${id}/restore`)
  },

  receiveItems(
    dirId: number,
    data: {
      type: string
      ids: number[]
      action: string
    },
  ) {
    return api.post(`/archive/dirs/${dirId}/receive`, data)
  },

  receiveItemsRoot(data: { type: string; ids: number[]; action: string }) {
    return api.post('/archive/dirs/receive', data)
  },

  getFileDetail(id: number) {
    return api.get<FileDetail>(`/archive/files/${id}`)
  },

  updateFile(id: number, data: { description?: string | null }) {
    return api.put(`/archive/files/${id}`, data)
  },

  deleteFile(id: number) {
    return api.delete(`/archive/files/${id}`)
  },

  restoreFile(id: number) {
    return api.patch(`/archive/files/${id}/restore`)
  },

  getFileUrl(id: number, size?: string) {
    const suffix = size ? `/${size}` : ''
    return api.get<{ url: string }>(`/archive/files/${id}/url${suffix}`)
  },

  createComment(fileId: number, data: { content: string }) {
    return api.post<{ comment: Comment }>(`/archive/files/${fileId}/comments`, data)
  },

  deleteComment(fileId: number, commentId: number) {
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
