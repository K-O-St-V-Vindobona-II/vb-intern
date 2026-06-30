import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ForgotPasswordView from '../ForgotPasswordView.vue'
import PrimeVue from 'primevue/config'
import authService from '@/services/authService'

const mockPush = vi.fn()

// Utilize importOriginal to retain original vue-router functionality
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
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
})
