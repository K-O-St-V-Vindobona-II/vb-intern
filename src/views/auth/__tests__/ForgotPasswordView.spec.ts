import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ForgotPasswordView from '../ForgotPasswordView.vue'
import PrimeVue from 'primevue/config'
import authService from '@/services/authService'
import type * as VueRouter from 'vue-router'

const mockPush = vi.fn()

// Utilize importOriginal to retain original vue-router functionality
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof VueRouter>()
  return {
    ...actual,
    useRouter: vi.fn(() => ({ push: mockPush })),
  }
})

vi.mock('@/services/authService')

describe('ForgotPasswordView.vue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should display an error if email input is empty', async () => {
    const wrapper = mount(ForgotPasswordView, { global: { plugins: [PrimeVue] } })
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.text()).toContain('Bitte gib deine E-Mail-Adresse ein')
  })

  it('should submit request and show success message for valid email', async () => {
    const wrapper = mount(ForgotPasswordView, { global: { plugins: [PrimeVue] } })
    vi.mocked(authService.requestPasswordReset).mockResolvedValue(undefined)

    await wrapper.find('input#email').setValue('test@verein.at')
    await wrapper.find('form').trigger('submit.prevent')

    expect(authService.requestPasswordReset).toHaveBeenCalledWith('test@verein.at')
    expect(wrapper.text()).toContain('einen Link zum Zurücksetzen')
  })

  it('shows a failure message and no success text when the request fails', async () => {
    const wrapper = mount(ForgotPasswordView, { global: { plugins: [PrimeVue] } })
    vi.mocked(authService.requestPasswordReset).mockRejectedValueOnce(new Error('Network Error'))

    await wrapper.find('input#email').setValue('test@verein.at')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('Ein unerwarteter Fehler ist aufgetreten.')
    expect(wrapper.text()).not.toContain('einen Link zum Zurücksetzen')
  })

  it('offers the way back to the login in the form and after success', async () => {
    const wrapper = mount(ForgotPasswordView, { global: { plugins: [PrimeVue] } })
    const back = () => wrapper.findAll('button').find((b) => b.text() === 'Zurück zum Login')!

    await back().trigger('click')
    expect(mockPush).toHaveBeenLastCalledWith({ name: 'login' })

    vi.mocked(authService.requestPasswordReset).mockResolvedValue(undefined)
    await wrapper.find('input#email').setValue('test@verein.at')
    await wrapper.find('form').trigger('submit.prevent')
    await back().trigger('click')

    expect(mockPush).toHaveBeenCalledTimes(2)
  })

  it('links the label to the e-mail input and names its autofill purpose', () => {
    const wrapper = mount(ForgotPasswordView, { global: { plugins: [PrimeVue] } })

    expect(wrapper.find('label').attributes('for')).toBe('email')
    expect(wrapper.find('input#email').attributes('autocomplete')).toBe('email')
    expect(wrapper.find('input#email').attributes('name')).toBe('email')
  })
})
