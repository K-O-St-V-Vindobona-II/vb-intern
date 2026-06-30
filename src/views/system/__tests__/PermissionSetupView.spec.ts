import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PermissionSetupView from '../PermissionSetupView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

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

const mockGetPermissionRules = vi.fn()
vi.mock('@/services/systemService', () => ({
  default: {
    getPermissionRules: (...args: unknown[]) => mockGetPermissionRules(...args),
  },
}))

const MOCK_RULES = [
  {
    permission: 'archiveAdmin',
    description: "Rolle 'Internetreferent' + Organisation VBW",
  },
  {
    permission: 'systemAdmin',
    description: "Rolle 'Internetreferent' + Organisation VBW",
  },
  {
    permission: 'standesdbContactAdmin',
    description: "Rolle 'Standesführer'",
  },
]

describe('PermissionSetupView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPermissionRules.mockResolvedValue({ data: MOCK_RULES })
  })

  const mountView = async () => {
    const w = mount(PermissionSetupView, {
      global: {
        plugins: [PrimeVue, ToastService],
      },
    })
    await flushPromises()
    return w
  }

  it('renders heading and subtitle', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Berechtigungs-Konfiguration')
  })

  it('renders permission names as tags', async () => {
    const w = await mountView()
    expect(w.text()).toContain('archiveAdmin')
    expect(w.text()).toContain('systemAdmin')
    expect(w.text()).toContain('standesdbContactAdmin')
  })

  it('renders condition descriptions', async () => {
    const w = await mountView()
    expect(w.text()).toContain("Rolle 'Internetreferent' + Organisation VBW")
    expect(w.text()).toContain("Rolle 'Standesführer'")
  })

  it('renders one row per rule', async () => {
    const w = await mountView()
    const rows = w.findAll('tr')
    expect(rows.length).toBe(4)
  })
})
