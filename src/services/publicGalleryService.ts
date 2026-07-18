import api from '@/services/api'

export interface GalleryImageAdminResponse {
  id: string
  url: string
  caption: string | null
  sort_order: number
  is_published: boolean
  width: number
  height: number
  size: number
  created_at: string
}

export interface GalleryImageUpdateRequest {
  caption: string | null
  is_published: boolean
}

export type GalleryImageMoveDirection = 'up' | 'down'

export default {
  listImages() {
    return api.get<GalleryImageAdminResponse[]>('/public-gallery-admin/images')
  },

  uploadImage(file: File, caption: string | null) {
    const formData = new FormData()
    formData.append('file', file)
    if (caption) formData.append('caption', caption)
    return api.post<GalleryImageAdminResponse>('/public-gallery-admin/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  updateImage(imageId: string, data: GalleryImageUpdateRequest) {
    return api.put<GalleryImageAdminResponse>(`/public-gallery-admin/images/${imageId}`, data)
  },

  moveImage(imageId: string, direction: GalleryImageMoveDirection) {
    return api.post(`/public-gallery-admin/images/${imageId}/move`, { direction })
  },

  deleteImage(imageId: string) {
    return api.delete(`/public-gallery-admin/images/${imageId}`)
  },
}
