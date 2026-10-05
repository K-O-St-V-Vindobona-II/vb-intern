import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ImagePreview from '../ImagePreview.vue'
import PrimeVue from 'primevue/config'

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error('not found')),
  },
}))

const mockGetImageUrl = vi.fn()
vi.mock('@/services/standesdbService', () => ({
  default: { getImageUrl: (...args: unknown[]) => mockGetImageUrl(...args) },
}))

function deferredUrl() {
  let resolvePromise!: (value: { data: { url: string } }) => void
  const promise = new Promise<{ data: { url: string } }>((resolve) => {
    resolvePromise = resolve
  })
  return { promise, resolve: (url: string) => resolvePromise({ data: { url } }) }
}

const mountWith = (props: InstanceType<typeof ImagePreview>['$props']) =>
  mount(ImagePreview, {
    props,
    global: { plugins: [PrimeVue] },
  })

describe('ImagePreview', () => {
  beforeEach(() => {
    mockGetImageUrl.mockReset()
    mockGetImageUrl.mockRejectedValue(new Error('not found'))
  })

  it('shows placeholder avatar when no imageId', () => {
    const w = mountWith({ imageId: null, ownerType: 'member', ownerId: '1' })
    expect(w.find('.placeholder-avatar').exists()).toBe(true)
  })

  it('does not render img when no imageId', () => {
    const w = mountWith({ imageId: null, ownerType: 'member', ownerId: '1' })
    expect(w.find('.profile-image').exists()).toBe(false)
  })

  it('asks for the thumbnail of a member with the member owner type', async () => {
    mountWith({ imageId: 'image-uuid-5', ownerType: 'member', ownerId: 'owner-1' })
    await flushPromises()

    expect(mockGetImageUrl).toHaveBeenCalledWith('member', 'owner-1', 'image-uuid-5', true)
  })

  it('requests the thumbnail of the given owner and shows it', async () => {
    mockGetImageUrl.mockResolvedValue({ data: { url: 'https://cdn.test/a.jpg' } })
    const w = mountWith({ imageId: 'image-uuid-5', ownerType: 'contact', ownerId: 'owner-1' })
    await flushPromises()

    expect(mockGetImageUrl).toHaveBeenCalledWith('contact', 'owner-1', 'image-uuid-5', true)
    expect(w.find('.profile-image').attributes('src')).toBe('https://cdn.test/a.jpg')
    expect(w.find('.placeholder-avatar').exists()).toBe(false)
  })

  it('falls back to the placeholder when the image cannot be loaded', async () => {
    const w = mountWith({ imageId: 'image-uuid-5', ownerType: 'member', ownerId: 'owner-1' })
    await flushPromises()

    expect(w.find('.profile-image').exists()).toBe(false)
    expect(w.find('.placeholder-avatar').exists()).toBe(true)
  })

  it('regression: a late answer for a removed image does not bring the picture back', async () => {
    const pending = deferredUrl()
    mockGetImageUrl.mockReturnValueOnce(pending.promise)
    const w = mountWith({ imageId: 'image-uuid-5', ownerType: 'member', ownerId: 'owner-1' })

    await w.setProps({ imageId: null })
    pending.resolve('https://cdn.test/removed.jpg')
    await flushPromises()

    expect(w.find('.profile-image').exists()).toBe(false)
    expect(w.find('.placeholder-avatar').exists()).toBe(true)
  })

  it('shows the newest image when an older request resolves last', async () => {
    const first = deferredUrl()
    const second = deferredUrl()
    mockGetImageUrl.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const w = mountWith({ imageId: 'image-a', ownerType: 'member', ownerId: 'owner-1' })

    await w.setProps({ imageId: 'image-b' })
    second.resolve('https://cdn.test/b.jpg')
    await flushPromises()
    first.resolve('https://cdn.test/a.jpg')
    await flushPromises()

    expect(w.find('.profile-image').attributes('src')).toBe('https://cdn.test/b.jpg')
  })
})
