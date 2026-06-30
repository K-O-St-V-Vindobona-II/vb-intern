import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginView from '../LoginView.vue'
import PrimeVue from 'primevue/config'

const mockPush = vi.fn()

// Dynamic mock to allow changing route parameters per test
const mockRouteState = { query: {} as Record<string, string> }
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    currentRoute: {
      get value() {
        return mockRouteState
      },
    },
  })),
  useRoute: vi.fn(() => mockRouteState),
}))

// Mock the authentication store methods
const mockLogin = vi.fn()
const mockGoogleLogin = vi.fn()
const mockLinkGoogle = vi.fn()

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    login: mockLogin,
    googleLogin: mockGoogleLogin,
    linkGoogle: mockLinkGoogle,
    user: null,
  })),
}))

describe('LoginView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteState.query = {}

    // Reset window location search for clean fallback testing
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    })
  })

  // --- STANDARD LOGIN TESTS ---

  it('should require email and password to submit', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [PrimeVue], stubs: { GoogleLogin: true } },
    })
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.text()).toContain('Bitte fülle alle Felder aus.')
  })

  it('should render a 401 unauthorized message upon invalid credentials', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [PrimeVue], stubs: { GoogleLogin: true } },
    })
    await wrapper.find('input#email').setValue('wrong@verein.at')
    await wrapper.find('#password input').setValue('wrong')

    mockLogin.mockRejectedValueOnce({ response: { status: 401 } })
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('Ungültige E-Mail-Adresse oder Passwort')
  })

  it('should display a fallback error message on backend crash (500)', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [PrimeVue], stubs: { GoogleLogin: true } },
    })
    await wrapper.find('input#email').setValue('test@verein.at')
    await wrapper.find('#password input').setValue('secret')

    mockLogin.mockRejectedValueOnce(new Error('Network Error'))
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('Ein unerwarteter Fehler ist aufgetreten.')
  })

  it('should explicitly redirect to the intended URL if redirect parameter is present', async () => {
    // Inject the simulated URL parameter for both the Router and the native fallback
    mockRouteState.query = { redirect: '/profile' }
    Object.defineProperty(window, 'location', {
      value: { search: '?redirect=/profile' },
      writable: true,
    })

    const wrapper = mount(LoginView, {
      global: { plugins: [PrimeVue], stubs: { GoogleLogin: true } },
    })
    mockLogin.mockResolvedValueOnce(undefined)

    await wrapper.find('input#email').setValue('test@verein.at')
    await wrapper.find('#password input').setValue('secret')
    await wrapper.find('form').trigger('submit.prevent')

    expect(mockPush).toHaveBeenCalledWith('/profile')
  })

  // --- GOOGLE LOGIN & LINKING TESTS ---

  it('should process a successful Google login', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [PrimeVue], stubs: { GoogleLogin: true } },
    })
    mockGoogleLogin.mockResolvedValueOnce(undefined)

    const googleComponent = wrapper.findComponent({ name: 'GoogleLogin' })
    await googleComponent.props('callback')({ credential: 'valid-google-token' })

    expect(mockGoogleLogin).toHaveBeenCalledWith('valid-google-token')
    expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
  })

  it('should detect unlinked accounts (404) and switch to linking form', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [PrimeVue], stubs: { GoogleLogin: true } },
    })

    mockGoogleLogin.mockRejectedValueOnce({
      response: { status: 404, data: { detail: 'ACCOUNT_NOT_LINKED' } },
    })

    const googleComponent = wrapper.findComponent({ name: 'GoogleLogin' })
    await googleComponent.props('callback')({ credential: 'unknown-google-token' })

    expect(wrapper.text()).toContain('Dein Google-Konto ist noch mit keinem Profil verknüpft')

    await wrapper.find('input#linkEmail').setValue('test@verein.at')
    await wrapper.find('#linkPassword input').setValue('secret')

    mockLinkGoogle.mockResolvedValueOnce(undefined)
    await wrapper.find('form').trigger('submit.prevent')

    expect(mockLinkGoogle).toHaveBeenCalledWith({
      credential: 'unknown-google-token',
      email: 'test@verein.at',
      password: 'secret',
    })
    expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
  })

  it('should handle backend crashes gracefully during Google login', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [PrimeVue], stubs: { GoogleLogin: true } },
    })

    mockGoogleLogin.mockRejectedValueOnce(new Error('Network Error'))

    const googleComponent = wrapper.findComponent({ name: 'GoogleLogin' })
    await googleComponent.props('callback')({ credential: 'token' })

    expect(wrapper.text()).toContain('Verbindung zum Backend fehlgeschlagen.')
  })
})
