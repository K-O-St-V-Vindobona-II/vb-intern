import { mount, flushPromises } from '@vue/test-utils'
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

const mockGetImageUrl = vi.fn()
vi.mock('@/services/standesdbService', () => ({
  default: { getImageUrl: (...args: unknown[]) => mockGetImageUrl(...args) },
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
    mockGetImageUrl.mockResolvedValue({ data: { url: 'https://cdn.test/avatar.jpg' } })
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

  it('loads and shows the avatar image when default_image is set', async () => {
    mockAuthStore.user = {
      id: 5,
      vorname: 'Maria',
      nachname: 'Muster',
      cn: 'Maria Muster',
      default_image: 3,
    }
    const wrapper = mount(AppNavbar, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    expect(mockGetImageUrl).toHaveBeenCalledWith('member', 5, 3, true)
    const img = wrapper.find('.avatar-img-sm')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://cdn.test/avatar.jpg')
    wrapper.unmount()
  })

  it('falls back to the placeholder icon when the avatar fails to load', async () => {
    mockGetImageUrl.mockRejectedValue(new Error('not found'))
    mockAuthStore.user = {
      vorname: 'Maria',
      nachname: 'Muster',
      cn: 'Maria Muster',
      default_image: 3,
    }
    const wrapper = mount(AppNavbar, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    expect(wrapper.find('.avatar-img-sm').exists()).toBe(false)
    expect(wrapper.find('.avatar-fallback').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not request an avatar when no default_image is set', async () => {
    mockAuthStore.user = { vorname: 'Maria', nachname: 'Muster', cn: 'Maria Muster' }
    mount(AppNavbar, { global: { plugins: [PrimeVue] } })
    await flushPromises()

    expect(mockGetImageUrl).not.toHaveBeenCalled()
  })

  it('logs out, closes the drawer and navigates to login', async () => {
    mockAuthStore.user = { cn: 'Maria Muster', default_image: null }
    const wrapper = mount(AppNavbar, {
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })
    await wrapper.find('.avatar-btn').trigger('click')

    const logoutBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Abmelden'),
    )!
    logoutBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockLogout).toHaveBeenCalledOnce()
    expect(mockPush).toHaveBeenCalledWith({ name: 'login' })
    wrapper.unmount()
  })

  it('navigates to the profile page and closes the drawer', async () => {
    mockAuthStore.user = { cn: 'Maria Muster', default_image: null }
    const wrapper = mount(AppNavbar, {
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })
    await wrapper.find('.avatar-btn').trigger('click')

    const profileBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Mein Benutzerkonto'),
    )!
    profileBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockPush).toHaveBeenCalledWith({ name: 'profile' })
    wrapper.unmount()
  })

  it('navigates to the permission-setup page and closes the drawer', async () => {
    mockAuthStore.user = { cn: 'Maria Muster', default_image: null }
    const wrapper = mount(AppNavbar, {
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })
    await wrapper.find('.avatar-btn').trigger('click')

    const permissionsBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Berechtigungen'),
    )!
    permissionsBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockPush).toHaveBeenCalledWith({ name: 'permission-setup' })
    wrapper.unmount()
  })

  it('falls back through vorname/nachname when cn is missing', async () => {
    mockAuthStore.user = { vorname: 'Maria', nachname: 'Muster', default_image: null }
    const wrapper = mount(AppNavbar, { global: { plugins: [PrimeVue] }, attachTo: document.body })
    await wrapper.find('.avatar-btn').trigger('click')

    expect(document.body.textContent).toContain('Maria Muster')
    wrapper.unmount()
  })

  it('falls back to email when no name is available', async () => {
    mockAuthStore.user = { email: 'maria@vb.at', default_image: null }
    const wrapper = mount(AppNavbar, { global: { plugins: [PrimeVue] }, attachTo: document.body })
    await wrapper.find('.avatar-btn').trigger('click')

    expect(document.body.textContent).toContain('maria@vb.at')
    wrapper.unmount()
  })

  it('shows the default idle timeout of 30 minutes when unset', async () => {
    mockAuthStore.user = { cn: 'Maria Muster', default_image: null }
    const wrapper = mount(AppNavbar, { global: { plugins: [PrimeVue] }, attachTo: document.body })
    await wrapper.find('.avatar-btn').trigger('click')

    expect(document.body.textContent).toContain('30 Min.')
    wrapper.unmount()
  })
})
