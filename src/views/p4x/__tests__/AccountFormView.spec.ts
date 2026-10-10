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
    id: '1',
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

    expect(mockUpdateAccount).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ iban: 'AT001234' }),
    )
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
      '1',
      expect.objectContaining({ init_date: '2021-05-15' }),
    )
    wrapper.unmount()
  })

  it('shows a retry state instead of a blank editable form when the account is not found', async () => {
    mockRoute.params = { id: '999' }
    mockGetDashboard.mockResolvedValue({ data: { accounts: [] } })
    const wrapper = mount(AccountFormView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Das Formular konnte nicht geladen werden.')
    expect(wrapper.text()).not.toContain('Konto bearbeiten')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Speichern')).toBe(false)
    wrapper.unmount()
  })

  it('shows a retry state instead of a blank editable form when loading fails, and recovers on retry', async () => {
    mockRoute.params = { id: '1' }
    mockGetDashboard.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(AccountFormView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Das Formular konnte nicht geladen werden.')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Speichern')).toBe(false)
    const retry = wrapper.findAll('button').find((b) => b.text() === 'Erneut versuchen')
    expect(retry).toBeDefined()

    mockGetDashboard.mockResolvedValueOnce({ data: { accounts: [buildAccount()] } })
    await retry!.trigger('click')
    await flushPromises()

    expect(mockGetDashboard).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('konnte nicht geladen werden')
    expect(wrapper.text()).toContain('Konto bearbeiten')
    expect(wrapper.findAll('input')[0]!.element.value).toBe('AT001234')
    wrapper.unmount()
  })

  it('loads init_date as the local calendar date, not shifted by the browser timezone (regression)', async () => {
    mockRoute.params = { id: '1' }
    mockGetDashboard.mockResolvedValue({
      data: { accounts: [buildAccount({ init_date: '2021-05-15' })] },
    })
    const wrapper = mount(AccountFormView, mountOpts)
    await flushPromises()

    const picker = wrapper.findComponent({ name: 'DatePicker' })
    const modelValue = picker.props('modelValue') as Date
    expect(modelValue.getFullYear()).toBe(2021)
    expect(modelValue.getMonth()).toBe(4)
    expect(modelValue.getDate()).toBe(15)
    wrapper.unmount()
  })

  it('sends a date picked in the form back as the same calendar date, not shifted to UTC (regression)', async () => {
    mockCreateAccount.mockResolvedValue({ data: buildAccount() })
    const wrapper = mount(AccountFormView, mountOpts)
    await flushPromises()

    const picker = wrapper.findComponent({ name: 'DatePicker' })
    await picker.vm.$emit('update:modelValue', new Date(2021, 4, 15))
    clickButton('Speichern')
    await flushPromises()

    expect(mockCreateAccount).toHaveBeenCalledWith(
      expect.objectContaining({ init_date: '2021-05-15' }),
    )
    wrapper.unmount()
  })

  it('shows a retry state instead of a blank editable form when the account is not found', async () => {
    mockRoute.params = { id: '999' }
    mockGetDashboard.mockResolvedValue({ data: { accounts: [] } })
    const wrapper = mount(AccountFormView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Konto bearbeiten')
    expect(wrapper.find('input').exists()).toBe(false)
    const retryBtn = wrapper.findAll('button').find((b) => b.text() === 'Erneut versuchen')
    expect(retryBtn).toBeTruthy()
    wrapper.unmount()
  })

  it('shows a retry state instead of a blank editable form when loading fails', async () => {
    mockRoute.params = { id: '1' }
    mockGetDashboard.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(AccountFormView, mountOpts)
    await flushPromises()

    expect(wrapper.find('input').exists()).toBe(false)
    const retryBtn = wrapper.findAll('button').find((b) => b.text() === 'Erneut versuchen')!

    mockGetDashboard.mockResolvedValueOnce({ data: { accounts: [buildAccount()] } })
    await retryBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Konto bearbeiten')
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
