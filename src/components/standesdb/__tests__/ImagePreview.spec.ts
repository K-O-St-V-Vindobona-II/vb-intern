import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ImagePreview from '../ImagePreview.vue'
import PrimeVue from 'primevue/config'

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error('not found')),
  },
}))

const mountWith = (props: Record<string, any>) =>
  mount(ImagePreview, {
    props,
    global: { plugins: [PrimeVue] },
  })

describe('ImagePreview', () => {
  it('shows placeholder avatar when no imageId', () => {
    const w = mountWith({ imageId: null, ownerType: 'member', ownerId: 1 })
    expect(w.find('.placeholder-avatar').exists()).toBe(true)
  })

  it('does not render img when no imageId', () => {
    const w = mountWith({ imageId: null, ownerType: 'member', ownerId: 1 })
    expect(w.find('.profile-image').exists()).toBe(false)
  })

  it('accepts member ownerType', () => {
    const w = mountWith({ imageId: 5, ownerType: 'member', ownerId: 1 })
    expect(w.exists()).toBe(true)
  })

  it('accepts contact ownerType', () => {
    const w = mountWith({ imageId: 5, ownerType: 'contact', ownerId: 1 })
    expect(w.exists()).toBe(true)
  })
})
