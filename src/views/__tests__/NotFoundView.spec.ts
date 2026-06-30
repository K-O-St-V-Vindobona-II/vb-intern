import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import NotFoundView from '../NotFoundView.vue'
import PrimeVue from 'primevue/config'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

describe('NotFoundView.vue', () => {
  it('renders the 404 message', () => {
    const wrapper = mount(NotFoundView, {
      global: { plugins: [PrimeVue] },
    })
    expect(wrapper.text()).toContain('Seite nicht gefunden')
    expect(wrapper.text()).toContain('existiert nicht')
  })

  it('navigates to home on button click', async () => {
    const wrapper = mount(NotFoundView, {
      global: { plugins: [PrimeVue] },
    })
    const btn = wrapper.findComponent({ name: 'Button' })
    await btn.trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
  })
})
