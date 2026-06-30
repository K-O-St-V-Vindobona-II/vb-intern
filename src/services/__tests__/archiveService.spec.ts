import { describe, it, expect, vi, beforeEach } from 'vitest'
import archiveService from '@/services/archiveService'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()
const mockPatch = vi.fn()
vi.mock('@/services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}))

describe('archiveService', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
    mockPatch.mockReset()
  })

  it('searchArchive forwards the query param', () => {
    archiveService.searchArchive('photo')
    expect(mockGet).toHaveBeenCalledWith('/archive/search', { params: { q: 'photo' } })
  })

  it('getDirRoot fetches the root directory', () => {
    archiveService.getDirRoot()
    expect(mockGet).toHaveBeenCalledWith('/archive/dirs')
  })

  it('getDirDetail fetches a single directory', () => {
    archiveService.getDirDetail(7)
    expect(mockGet).toHaveBeenCalledWith('/archive/dirs/7')
  })

  it('createDir posts the new directory payload', () => {
    const data = { name: 'Fotos', permissions: ['x'], recursive_permissions: true }
    archiveService.createDir(data)
    expect(mockPost).toHaveBeenCalledWith('/archive/dirs', data)
  })

  it('updateDir puts the updated directory payload', () => {
    const data = { name: 'Fotos 2', permissions: [], recursive_permissions: false }
    archiveService.updateDir(7, data)
    expect(mockPut).toHaveBeenCalledWith('/archive/dirs/7', data)
  })

  it('deleteDir deletes the directory', () => {
    archiveService.deleteDir(7)
    expect(mockDelete).toHaveBeenCalledWith('/archive/dirs/7')
  })

  it('restoreDir patches the restore endpoint', () => {
    archiveService.restoreDir(7)
    expect(mockPatch).toHaveBeenCalledWith('/archive/dirs/7/restore')
  })

  it('receiveItems posts to the dir-scoped receive endpoint', () => {
    const data = { type: 'file', ids: [1, 2], action: 'move' }
    archiveService.receiveItems(7, data)
    expect(mockPost).toHaveBeenCalledWith('/archive/dirs/7/receive', data)
  })

  it('receiveItemsRoot posts to the root receive endpoint', () => {
    const data = { type: 'dir', ids: [3], action: 'move' }
    archiveService.receiveItemsRoot(data)
    expect(mockPost).toHaveBeenCalledWith('/archive/dirs/receive', data)
  })

  it('getFileDetail fetches a single file', () => {
    archiveService.getFileDetail(42)
    expect(mockGet).toHaveBeenCalledWith('/archive/files/42')
  })

  it('updateFile puts the updated description', () => {
    archiveService.updateFile(42, { description: 'neu' })
    expect(mockPut).toHaveBeenCalledWith('/archive/files/42', { description: 'neu' })
  })

  it('deleteFile deletes the file', () => {
    archiveService.deleteFile(42)
    expect(mockDelete).toHaveBeenCalledWith('/archive/files/42')
  })

  it('restoreFile patches the restore endpoint', () => {
    archiveService.restoreFile(42)
    expect(mockPatch).toHaveBeenCalledWith('/archive/files/42/restore')
  })

  it('getFileUrl without size omits the suffix', () => {
    archiveService.getFileUrl(42)
    expect(mockGet).toHaveBeenCalledWith('/archive/files/42/url')
  })

  it('getFileUrl with size appends the suffix', () => {
    archiveService.getFileUrl(42, 'thumb')
    expect(mockGet).toHaveBeenCalledWith('/archive/files/42/url/thumb')
  })

  it('createComment posts the comment content', () => {
    archiveService.createComment(42, { content: 'Schöner Schnappschuss' })
    expect(mockPost).toHaveBeenCalledWith('/archive/files/42/comments', {
      content: 'Schöner Schnappschuss',
    })
  })

  it('deleteComment deletes the comment', () => {
    archiveService.deleteComment(42, 9)
    expect(mockDelete).toHaveBeenCalledWith('/archive/files/42/comments/9')
  })

  it('getUploadConfig fetches upload limits', () => {
    archiveService.getUploadConfig()
    expect(mockGet).toHaveBeenCalledWith('/archive/upload/config')
  })

  it('getUnfiledUploads fetches unfiled uploads', () => {
    archiveService.getUnfiledUploads()
    expect(mockGet).toHaveBeenCalledWith('/archive/upload/unfiled')
  })

  it('uploadFile sends a multipart form with file and description', () => {
    const file = new File(['x'], 'test.pdf')
    archiveService.uploadFile(file, 'Beschreibung')

    expect(mockPost).toHaveBeenCalledWith('/archive/upload', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const formData = mockPost.mock.calls[0][1] as FormData
    expect(formData.get('file')).toBe(file)
    expect(formData.get('description')).toBe('Beschreibung')
  })
})
