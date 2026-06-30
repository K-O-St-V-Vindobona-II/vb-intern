import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FileIcon from '../FileIcon.vue'

const mockLoadPresignedUrl = vi.fn()
vi.mock('@/composables/useArchiveDownload', () => ({
  useArchiveDownload: () => ({ loadPresignedUrl: mockLoadPresignedUrl }),
}))

let observerCallback: IntersectionObserverCallback | null = null
const observe = vi.fn()
const disconnect = vi.fn()

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback
  }
  observe = observe
  disconnect = disconnect
  unobserve = vi.fn()
  takeRecords = vi.fn(() => [])
  root = null
  rootMargin = ''
  thresholds = []
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

function triggerIntersect(isIntersecting: boolean) {
  observerCallback?.([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver)
}

describe('FileIcon', () => {
  beforeEach(() => {
    mockLoadPresignedUrl.mockReset()
    observe.mockClear()
    disconnect.mockClear()
    observerCallback = null
  })

  it.each([
    ['jpg', 'pi pi-image'],
    ['jpeg', 'pi pi-image'],
    ['gif', 'pi pi-image'],
    ['png', 'pi pi-image'],
    ['doc', 'pi pi-file-word'],
    ['docx', 'pi pi-file-word'],
    ['xls', 'pi pi-file-excel'],
    ['xlsx', 'pi pi-file-excel'],
    ['pdf', 'pi pi-file-pdf'],
    ['mp4', 'pi pi-play'],
    ['avi', 'pi pi-play'],
    ['txt', 'pi pi-file'],
    [null, 'pi pi-file'],
  ])('shows the correct icon for extension %s', (extension, expectedClass) => {
    const wrapper = mount(FileIcon, {
      props: { extension, isImage: false },
    })
    expect(wrapper.find('i').classes().join(' ')).toBe(expectedClass)
  })

  it('is case-insensitive for the extension', () => {
    const wrapper = mount(FileIcon, {
      props: { extension: 'PDF', isImage: false },
    })
    expect(wrapper.find('i').classes().join(' ')).toBe('pi pi-file-pdf')
  })

  it('does not observe or load a thumbnail when isImage is false', () => {
    mount(FileIcon, { props: { extension: 'png', isImage: false, fileId: 1 } })
    expect(observe).not.toHaveBeenCalled()
  })

  it('does not observe or load a thumbnail when trashed', () => {
    mount(FileIcon, { props: { extension: 'png', isImage: true, fileId: 1, trash: true } })
    expect(observe).not.toHaveBeenCalled()
  })

  it('does not observe when there is no fileId', () => {
    mount(FileIcon, { props: { extension: 'png', isImage: true } })
    expect(observe).not.toHaveBeenCalled()
  })

  it('loads and displays the thumbnail once the icon becomes visible', async () => {
    mockLoadPresignedUrl.mockResolvedValue('https://minio.test/thumb.jpg')
    const wrapper = mount(FileIcon, {
      props: { extension: 'png', isImage: true, fileId: 7 },
    })

    expect(observe).toHaveBeenCalledOnce()
    triggerIntersect(true)
    await vi.waitUntil(() => wrapper.find('img').exists())

    expect(mockLoadPresignedUrl).toHaveBeenCalledWith(7, 'xs')
    expect(wrapper.find('img').attributes('src')).toBe('https://minio.test/thumb.jpg')
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('requests the md size when size prop is set', async () => {
    mockLoadPresignedUrl.mockResolvedValue('https://minio.test/thumb-md.jpg')
    mount(FileIcon, {
      props: { extension: 'png', isImage: true, fileId: 7, size: 'md' },
    })

    triggerIntersect(true)
    await vi.waitFor(() => expect(mockLoadPresignedUrl).toHaveBeenCalledWith(7, 'md'))
  })

  it('ignores non-intersecting observer entries', () => {
    mount(FileIcon, { props: { extension: 'png', isImage: true, fileId: 7 } })

    triggerIntersect(false)

    expect(mockLoadPresignedUrl).not.toHaveBeenCalled()
  })

  it('reloads the thumbnail when fileId changes after becoming visible', async () => {
    mockLoadPresignedUrl.mockResolvedValue('https://minio.test/a.jpg')
    const wrapper = mount(FileIcon, {
      props: { extension: 'png', isImage: true, fileId: 7 },
    })
    triggerIntersect(true)
    await vi.waitFor(() => expect(mockLoadPresignedUrl).toHaveBeenCalledTimes(1))

    mockLoadPresignedUrl.mockResolvedValue('https://minio.test/b.jpg')
    await wrapper.setProps({ fileId: 8 })

    expect(mockLoadPresignedUrl).toHaveBeenCalledWith(8, 'xs')
  })
})
