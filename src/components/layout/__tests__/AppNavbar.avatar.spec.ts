import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import AppNavbar from '@/components/layout/AppNavbar.vue'
import PrimeVue from 'primevue/config'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
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

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

interface TestUser {
  id: string
  cn: string
  default_image: string | null
}

const mockAuthStore = reactive<{ user: TestUser | null; logout: () => Promise<void> }>({
  user: null,
  logout: vi.fn(),
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

vi.mock('@/composables/useNavigation', () => ({
  useNavigation: vi.fn(() => ({ mainMenuItems: [] })),
}))

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), defaults: { baseURL: '' } },
}))

vi.mock('@/composables/useSessionManager', () => ({
  useSessionManager: vi.fn(() => ({ loginTime: ref('') })),
}))

const mockGetImageUrl = vi.fn()
vi.mock('@/services/standesdbService', () => ({
  default: { getImageUrl: (...args: unknown[]) => mockGetImageUrl(...args) },
}))

interface Deferred {
  promise: Promise<{ data: { url: string } }>
  resolve: (url: string) => void
}

function deferredImageUrl(): Deferred {
  let resolvePromise!: (value: { data: { url: string } }) => void
  const promise = new Promise<{ data: { url: string } }>((resolve) => {
    resolvePromise = resolve
  })
  return { promise, resolve: (url) => resolvePromise({ data: { url } }) }
}

function userWithImage(defaultImage: string | null): TestUser {
  return { id: 'user-1', cn: 'Maria Muster', default_image: defaultImage }
}

// The auth store mock is shared and reactive, so a component left mounted by
// one test would keep reacting to the next test's user changes.
let mounted: VueWrapper | null = null

function mountNavbar(): VueWrapper {
  mounted = mount(AppNavbar, { global: { plugins: [PrimeVue] } })
  return mounted
}

describe('AppNavbar.vue avatar loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user = null
  })

  afterEach(() => {
    mounted?.unmount()
    mounted = null
  })

  it('regression: a late answer for a removed default image does not bring the avatar back', async () => {
    const pending = deferredImageUrl()
    mockGetImageUrl.mockReturnValueOnce(pending.promise)
    mockAuthStore.user = userWithImage('image-a')
    const wrapper = mountNavbar()

    mockAuthStore.user = userWithImage(null)
    await nextTick()
    pending.resolve('https://cdn.test/removed.jpg')
    await flushPromises()

    expect(wrapper.find('.avatar-img-sm').exists()).toBe(false)
    expect(wrapper.find('.avatar-fallback').exists()).toBe(true)
  })

  it('shows the answer of the newest request when an older one resolves last', async () => {
    const first = deferredImageUrl()
    const second = deferredImageUrl()
    mockGetImageUrl.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    mockAuthStore.user = userWithImage('image-a')
    const wrapper = mountNavbar()

    mockAuthStore.user = userWithImage('image-b')
    await nextTick()
    second.resolve('https://cdn.test/b.jpg')
    await flushPromises()
    first.resolve('https://cdn.test/a.jpg')
    await flushPromises()

    expect(wrapper.find('.avatar-img-sm').attributes('src')).toBe('https://cdn.test/b.jpg')
  })

  it('exposes accessible names for the icon-only logo and avatar controls', () => {
    mockAuthStore.user = userWithImage(null)
    const wrapper = mountNavbar()

    expect(wrapper.find('button.logo-container').attributes('aria-label')).toBe('Zur Startseite')
    expect(wrapper.find('button.avatar-btn').attributes('aria-label')).toBe('Profilmenü öffnen')
    expect(wrapper.find('button.avatar-btn').attributes('aria-haspopup')).toBe('dialog')
  })
})
