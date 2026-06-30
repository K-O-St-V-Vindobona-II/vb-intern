import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DirGallery from '../DirGallery.vue'
import PrimeVue from 'primevue/config'
import type { FileShort } from '@/types/archive'

const mockLoadPresignedUrl = vi.fn()
const mockTriggerDownload = vi.fn()
vi.mock('@/composables/useArchiveDownload', () => ({
  useArchiveDownload: () => ({
    loadPresignedUrl: mockLoadPresignedUrl,
    triggerDownload: mockTriggerDownload,
  }),
}))

function buildFile(overrides: Partial<FileShort> = {}): FileShort {
  return {
    type: 'file',
    id: 1,
    name: 'Bild',
    extension: 'jpg',
    description: null,
    size: 1024,
    is_image: true,
    mime_type: 'image/jpeg',
    created_at: null,
    deleted_at: null,
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

describe('DirGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadPresignedUrl.mockResolvedValue('https://minio.test/img.jpg')
  })

  it('does not show a gallery button when there are no images', () => {
    const wrapper = mount(DirGallery, {
      props: { files: [buildFile({ is_image: false })] },
      ...mountOpts,
    })
    expect(wrapper.find('.gallery-btn').exists()).toBe(false)
    wrapper.unmount()
  })

  it('ignores non-image files for the gallery', () => {
    const wrapper = mount(DirGallery, {
      props: {
        files: [buildFile({ id: 1, is_image: false }), buildFile({ id: 2, is_image: true })],
      },
      ...mountOpts,
    })
    expect(wrapper.find('.gallery-btn').exists()).toBe(true)
    wrapper.unmount()
  })

  it('opens the dialog and loads the first image', async () => {
    const wrapper = mount(DirGallery, {
      props: { files: [buildFile({ id: 1, name: 'Erstes' })] },
      ...mountOpts,
    })

    await wrapper.find('.gallery-btn').trigger('click')
    await flushPromises()

    expect(mockLoadPresignedUrl).toHaveBeenCalledWith(1, 'lg')
    expect(document.body.innerHTML).toContain('Erstes.jpg')
    expect(document.querySelector('.gallery-counter')?.textContent).toContain('1 / 1')

    wrapper.unmount()
  })

  it('navigates to the next image and wraps around to the first', async () => {
    const wrapper = mount(DirGallery, {
      props: {
        files: [buildFile({ id: 1, name: 'A' }), buildFile({ id: 2, name: 'B' })],
      },
      ...mountOpts,
    })
    await wrapper.find('.gallery-btn').trigger('click')
    await flushPromises()

    const nextBtn = document.querySelector('.gallery-nav button:nth-child(2)') as HTMLElement
    nextBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(mockLoadPresignedUrl).toHaveBeenLastCalledWith(2, 'lg')

    nextBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(mockLoadPresignedUrl).toHaveBeenLastCalledWith(1, 'lg')

    wrapper.unmount()
  })

  it('navigates to the previous image and wraps around to the last', async () => {
    const wrapper = mount(DirGallery, {
      props: {
        files: [buildFile({ id: 1, name: 'A' }), buildFile({ id: 2, name: 'B' })],
      },
      ...mountOpts,
    })
    await wrapper.find('.gallery-btn').trigger('click')
    await flushPromises()

    const prevBtn = document.querySelector('.gallery-nav button:nth-child(1)') as HTMLElement
    prevBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockLoadPresignedUrl).toHaveBeenLastCalledWith(2, 'lg')

    wrapper.unmount()
  })

  it('downloads the current image with its name and extension', async () => {
    const wrapper = mount(DirGallery, {
      props: { files: [buildFile({ id: 7, name: 'Urlaub', extension: 'png' })] },
      ...mountOpts,
    })
    await wrapper.find('.gallery-btn').trigger('click')
    await flushPromises()

    const downloadBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Herunterladen'),
    ) as HTMLElement
    downloadBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(mockTriggerDownload).toHaveBeenCalledWith(7, 'Urlaub.png')

    wrapper.unmount()
  })

  it('only applies the latest of two rapidly-fired image loads (race-condition guard)', async () => {
    let resolveFirst!: (url: string) => void
    const firstLoad = new Promise<string>((resolve) => {
      resolveFirst = resolve
    })
    mockLoadPresignedUrl.mockReturnValueOnce(firstLoad)
    mockLoadPresignedUrl.mockResolvedValueOnce('https://minio.test/second.jpg')

    const wrapper = mount(DirGallery, {
      props: {
        files: [buildFile({ id: 1, name: 'A' }), buildFile({ id: 2, name: 'B' })],
      },
      ...mountOpts,
    })

    await wrapper.find('.gallery-btn').trigger('click')
    const nextBtn = document.querySelector('.gallery-nav button:nth-child(2)') as HTMLElement
    nextBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    // The first (slow) request resolves after the second (fast) one already won.
    resolveFirst('https://minio.test/stale.jpg')
    await flushPromises()

    expect(document.querySelector('.gallery-img')?.getAttribute('src')).toBe(
      'https://minio.test/second.jpg',
    )

    wrapper.unmount()
  })
})
