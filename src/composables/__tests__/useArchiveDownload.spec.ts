import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useArchiveDownload } from '../useArchiveDownload'

const mockGet = vi.fn()
vi.mock('@/services/api', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}))

describe('useArchiveDownload', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('loadPresignedUrl returns URL from API', async () => {
    mockGet.mockResolvedValueOnce({
      data: { url: 'https://minio.test/file?sig=abc' },
    })
    const { loadPresignedUrl } = useArchiveDownload()
    const url = await loadPresignedUrl(42, 'md')
    expect(url).toBe('https://minio.test/file?sig=abc')
    expect(mockGet).toHaveBeenCalledWith('/archive/files/42/url/md')
  })

  it('loadPresignedUrl without size calls /url', async () => {
    mockGet.mockResolvedValueOnce({
      data: { url: 'https://minio.test/orig' },
    })
    const { loadPresignedUrl } = useArchiveDownload()
    const url = await loadPresignedUrl(7)
    expect(url).toBe('https://minio.test/orig')
    expect(mockGet).toHaveBeenCalledWith('/archive/files/7/url')
  })

  it('loadPresignedUrl returns null on error', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'))
    const { loadPresignedUrl } = useArchiveDownload()
    const url = await loadPresignedUrl(99)
    expect(url).toBeNull()
  })

  it('triggerDownload creates anchor and clicks it', async () => {
    mockGet.mockResolvedValueOnce({
      data: { url: 'https://minio.test/dl' },
    })
    const clickSpy = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValueOnce({
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLAnchorElement)

    const { triggerDownload } = useArchiveDownload()
    await triggerDownload(1, 'test.pdf')
    expect(clickSpy).toHaveBeenCalled()
  })

  it('triggerDownload handles error silently', async () => {
    mockGet.mockRejectedValueOnce(new Error('fail'))
    const { triggerDownload } = useArchiveDownload()
    await expect(triggerDownload(1, 'test.pdf')).resolves.toBeUndefined()
  })

  it('returns the cached URL without calling the API again within the TTL', async () => {
    mockGet.mockResolvedValueOnce({
      data: { url: 'https://minio.test/cached' },
    })
    const { loadPresignedUrl } = useArchiveDownload()

    const first = await loadPresignedUrl(555, 'sm')
    const second = await loadPresignedUrl(555, 'sm')

    expect(first).toBe('https://minio.test/cached')
    expect(second).toBe('https://minio.test/cached')
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('evicts the least recently used entry once the cache exceeds its max size', async () => {
    const { loadPresignedUrl } = useArchiveDownload()
    mockGet.mockImplementation(async (url: unknown) => ({
      data: { url: `resolved:${String(url)}` },
    }))

    // Insert well past MAX_CACHE_SIZE (50) with file ids unused by any other test.
    for (let i = 20000; i < 20000 + 55; i++) {
      await loadPresignedUrl(i)
    }

    // The most recently inserted entry must still be cached (no extra API call).
    mockGet.mockClear()
    const result = await loadPresignedUrl(20054)

    expect(result).toBe('resolved:/archive/files/20054/url')
    expect(mockGet).not.toHaveBeenCalled()
  })
})
