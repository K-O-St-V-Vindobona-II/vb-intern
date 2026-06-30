import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import HomeView from '../HomeView.vue'
import PrimeVue from 'primevue/config'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockAuthStore = { user: null as any }
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

describe('HomeView.vue', () => {
  it('should render four quick-access tiles', () => {
    mockAuthStore.user = { cn: 'Max Mustermann v/o Kopernikus' }
    const wrapper = mount(HomeView, { global: { plugins: [PrimeVue] } })
    expect(wrapper.text()).toContain('Upload-Center')
    expect(wrapper.text()).toContain('Mitgliederverwaltung')
    expect(wrapper.text()).toContain('Archiv')
    expect(wrapper.text()).toContain('Zahlungsinformation')
  })

  it('should show welcome text and user cn', () => {
    mockAuthStore.user = { cn: 'Max Mustermann v/o Kopernikus' }
    const wrapper = mount(HomeView, { global: { plugins: [PrimeVue] } })
    expect(wrapper.text()).toContain('Willkommen im internen Bereich')
    expect(wrapper.text()).toContain('Max Mustermann v/o Kopernikus')
  })

  it('should navigate when a tile is clicked', async () => {
    mockAuthStore.user = { cn: 'Test' }
    const wrapper = mount(HomeView, { global: { plugins: [PrimeVue] } })
    await wrapper.find('.tile').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'archive-upload' })
  })
})
