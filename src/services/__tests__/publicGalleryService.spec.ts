import { describe, it, expect, vi, beforeEach } from 'vitest'
import publicGalleryService from '@/services/publicGalleryService'

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

describe('publicGalleryService', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
  })

  it('listImages fetches /public-gallery-admin/images', () => {
    publicGalleryService.listImages()
    expect(mockGet).toHaveBeenCalledWith('/public-gallery-admin/images')
  })

  it('uploadImage posts multipart form data with file and caption', () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    publicGalleryService.uploadImage(file, 'Ein Bild')

    expect(mockPost).toHaveBeenCalledTimes(1)
    const [url, formData, config] = mockPost.mock.calls[0]
    expect(url).toBe('/public-gallery-admin/images')
    expect(formData).toBeInstanceOf(FormData)
    expect(formData.get('file')).toBe(file)
    expect(formData.get('caption')).toBe('Ein Bild')
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
  })

  it('uploadImage omits caption field when null', () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    publicGalleryService.uploadImage(file, null)

    const formData = mockPost.mock.calls[0][1] as FormData
    expect(formData.get('caption')).toBeNull()
  })

  it('updateImage puts caption and is_published', () => {
    publicGalleryService.updateImage('img-1', { caption: 'Neu', is_published: false })
    expect(mockPut).toHaveBeenCalledWith('/public-gallery-admin/images/img-1', {
      caption: 'Neu',
      is_published: false,
    })
  })

  it('moveImage posts the move direction', () => {
    publicGalleryService.moveImage('img-1', 'up')
    expect(mockPost).toHaveBeenCalledWith('/public-gallery-admin/images/img-1/move', {
      direction: 'up',
    })
  })

  it('deleteImage sends a DELETE request', () => {
    publicGalleryService.deleteImage('img-1')
    expect(mockDelete).toHaveBeenCalledWith('/public-gallery-admin/images/img-1')
  })
})
