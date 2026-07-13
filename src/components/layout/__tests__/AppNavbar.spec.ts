import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AppNavbar from '@/components/layout/AppNavbar.vue'
import PrimeVue from 'primevue/config'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockLogout = vi.fn()
const mockAuthStore = {
  user: null as any,
  logout: mockLogout,
}

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

vi.mock('@/composables/useNavigation', () => ({
  useNavigation: vi.fn(() => ({
    mainMenuItems: [{ label: 'Standesdatenbank', icon: 'pi pi-database', items: [] }],
  })),
}))

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), defaults: { baseURL: '' } },
}))

vi.mock('@/composables/useSessionManager', () => ({
  useSessionManager: vi.fn(() => ({
    loginTime: { value: '25.06.2026, 10:00' },
  })),
}))

describe('AppNavbar.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user = null
  })

  it('renders the logo text', () => {
    const wrapper = mount(AppNavbar, { global: { plugins: [PrimeVue] } })
    expect(wrapper.text()).toContain('VB intern')
  })

  it('hides avatar button when not logged in', () => {
    const wrapper = mount(AppNavbar, { global: { plugins: [PrimeVue] } })
    expect(wrapper.find('.avatar-btn').exists()).toBe(false)
  })

  it('shows avatar button when logged in', () => {
    mockAuthStore.user = {
      vorname: 'Maria',
      nachname: 'Muster',
      cn: 'Maria Muster',
      default_image: null,
    }
    const wrapper = mount(AppNavbar, { global: { plugins: [PrimeVue] } })
    expect(wrapper.find('.avatar-btn').exists()).toBe(true)
  })

  it('navigates to home on logo click', async () => {
    const wrapper = mount(AppNavbar, { global: { plugins: [PrimeVue] } })
    await wrapper.find('.logo-container').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
  })

  it('shows idle-timeout info instead of a misleading access-token countdown', async () => {
    mockAuthStore.user = {
      vorname: 'Maria',
      nachname: 'Muster',
      cn: 'Maria Muster',
      default_image: null,
      session_idle_timeout: 45,
    }
    const wrapper = mount(AppNavbar, { global: { plugins: [PrimeVue] }, attachTo: document.body })
    await wrapper.find('.avatar-btn').trigger('click')

    expect(document.body.textContent).toContain('45 Min.')
    expect(document.body.textContent).toContain('Inaktivität')
    expect(document.body.textContent).not.toContain('Abmeldung in spätestens')

    wrapper.unmount()
  })
})
