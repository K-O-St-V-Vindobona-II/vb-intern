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
    cns: ['Max Mustermann v/o Testator', 'Erika Musterfrau'],
  },
  {
    permission: 'systemAdmin',
    description: "Rolle 'Internetreferent' + Organisation VBW",
    cns: ['Max Mustermann v/o Testator'],
  },
  {
    permission: 'standesdbContactAdmin',
    description: "Rolle 'Standesführer'",
    cns: [],
  },
]

describe('PermissionSetupView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPermissionRules.mockResolvedValue({
      data: { rules: MOCK_RULES, dev_superuser_cn: null },
    })
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

  it('renders one holder name per line', async () => {
    const w = await mountView()
    const archiveRow = w.findAll('tr').find((row) => row.text().includes('archiveAdmin'))
    const names = archiveRow
      ?.findAll('td')
      .at(-1)
      ?.findAll('div')
      .map((d) => d.text())
    expect(names).toEqual(['Max Mustermann v/o Testator', 'Erika Musterfrau'])
  })

  it('renders a dash when no one holds the permission', async () => {
    const w = await mountView()
    const row = w.findAll('tr').find((r) => r.text().includes('standesdbContactAdmin'))
    expect(row?.text()).toContain('–')
  })

  it('does not render a dev-superuser notice when unset', async () => {
    const w = await mountView()
    expect(w.text()).not.toContain('automatisch alle Berechtigungen')
  })

  it('renders a dev-superuser notice once when set', async () => {
    mockGetPermissionRules.mockResolvedValue({
      data: { rules: MOCK_RULES, dev_superuser_cn: 'Michael Alexander Schimpl v/o Kopernikus' },
    })
    const w = await mountView()
    expect(w.text()).toContain(
      'Michael Alexander Schimpl v/o Kopernikus hat in der dev-Umgebung automatisch alle Berechtigungen.',
    )
  })
})
