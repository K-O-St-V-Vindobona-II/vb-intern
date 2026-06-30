import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AccountFormView from '../AccountFormView.vue'
import PrimeVue from 'primevue/config'
import type { P4xAccount } from '@/types/p4x'

const mockPush = vi.fn()
const mockRoute: { params: Record<string, string> } = { params: {} }
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockGetDashboard = vi.fn()
const mockCreateAccount = vi.fn()
const mockUpdateAccount = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
    createAccount: (...args: unknown[]) => mockCreateAccount(...args),
    updateAccount: (...args: unknown[]) => mockUpdateAccount(...args),
  },
}))

function buildAccount(overrides: Partial<P4xAccount> = {}): P4xAccount {
  return {
    id: 1,
    iban: 'AT001234',
    bic: 'GIBAATWWXXX',
    label: 'Kasse Wien',
    init_date: '2020-01-01',
    init_balance: 50,
    balance: 100,
    transactions_count: 5,
    transactions_latest: '2026-06-01',
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

function clickButton(text: string) {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text)!
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('AccountFormView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.params = {}
  })

  it('shows the create-mode title and an empty form when there is no id param', async () => {
    const wrapper = mount(AccountFormView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Konto anlegen')
    expect(mockGetDashboard).not.toHaveBeenCalled()
    expect(wrapper.find('input').element.value).toBe('')
    wrapper.unmount()
  })

  it('loads the existing account in edit mode and pre-fills the form', async () => {
    mockRoute.params = { id: '1' }
    mockGetDashboard.mockResolvedValue({ data: { accounts: [buildAccount()] } })
    const wrapper = mount(AccountFormView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Konto bearbeiten')
    const ibanInput = wrapper.findAll('input')[0]
    expect(ibanInput!.element.value).toBe('AT001234')
    wrapper.unmount()
  })

  it('creates a new account with the iban/bic/label fields and navigates back on save', async () => {
    mockCreateAccount.mockResolvedValue({ data: buildAccount() })
    const wrapper = mount(AccountFormView, mountOpts)
    await flushPromises()

    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('AT999999')
    await inputs[1]!.setValue('GIBAATWW')
    await inputs[2]!.setValue('Neues Konto')

    clickButton('Speichern')
    await flushPromises()

    expect(mockCreateAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        iban: 'AT999999',
        bic: 'GIBAATWW',
        label: 'Neues Konto',
        init_date: '',
      }),
    )
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Konto angelegt' }),
    )
    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-dashboard' })
    wrapper.unmount()
  })

  it('updates an existing account and navigates back on save', async () => {
    mockRoute.params = { id: '1' }
    mockGetDashboard.mockResolvedValue({ data: { accounts: [buildAccount()] } })
    mockUpdateAccount.mockResolvedValue({ data: buildAccount() })
    const wrapper = mount(AccountFormView, mountOpts)
    await flushPromises()

    clickButton('Speichern')
    await flushPromises()

    expect(mockUpdateAccount).toHaveBeenCalledWith(1, expect.objectContaining({ iban: 'AT001234' }))
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Gespeichert' }),
    )
    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-dashboard' })
    wrapper.unmount()
  })

  it('formats the init_date as an ISO date string when one is set', async () => {
    mockRoute.params = { id: '1' }
    mockGetDashboard.mockResolvedValue({
      data: { accounts: [buildAccount({ init_date: '2021-05-15' })] },
    })
    mockUpdateAccount.mockResolvedValue({ data: buildAccount() })
    const wrapper = mount(AccountFormView, mountOpts)
    await flushPromises()

    clickButton('Speichern')
    await flushPromises()

    expect(mockUpdateAccount).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ init_date: '2021-05-15' }),
    )
    wrapper.unmount()
  })

  it('shows an error toast and does not navigate when saving fails', async () => {
    mockCreateAccount.mockRejectedValue({ response: { data: { detail: 'IBAN ungültig' } } })
    const wrapper = mount(AccountFormView, mountOpts)
    await flushPromises()

    clickButton('Speichern')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'IBAN ungültig' }),
    )
    expect(mockPush).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('navigates back to the dashboard without saving', async () => {
    const wrapper = mount(AccountFormView, mountOpts)
    await flushPromises()

    clickButton('Zur Liste')

    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-dashboard' })
    expect(mockCreateAccount).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
