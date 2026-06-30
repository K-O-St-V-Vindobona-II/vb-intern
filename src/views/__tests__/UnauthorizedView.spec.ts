import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import UnauthorizedView from '../UnauthorizedView.vue'
import PrimeVue from 'primevue/config'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

describe('UnauthorizedView.vue', () => {
  it('should render the unauthorized message correctly', () => {
    const wrapper = mount(UnauthorizedView, { global: { plugins: [PrimeVue] } })

    expect(wrapper.text()).toContain('Zugriff verweigert')
    expect(wrapper.text()).toContain('nicht über die notwendigen Berechtigungen')
  })

  it('should navigate back to the home dashboard when clicking the button', async () => {
    const wrapper = mount(UnauthorizedView, { global: { plugins: [PrimeVue] } })

    const btn = wrapper.findComponent({ name: 'Button' })
    await btn.trigger('click')

    expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
  })
})
