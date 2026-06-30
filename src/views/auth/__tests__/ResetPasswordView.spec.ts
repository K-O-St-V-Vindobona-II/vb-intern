import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ResetPasswordView from '../ResetPasswordView.vue'
import PrimeVue from 'primevue/config'
import authService from '@/services/authService'

const mockPush = vi.fn()

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: vi.fn(() => ({ push: mockPush })),
    useRoute: vi.fn(() => ({ query: { email: 'test@verein.at', token: '12345' } })),
  }
})

vi.mock('@/services/authService')

// Stub env variable for minimum password length
vi.stubEnv('VITE_PASSWORD_MIN_LENGTH', '8')

describe('ResetPasswordView.vue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should refuse short passwords based on env configuration', async () => {
    const wrapper = mount(ResetPasswordView, { global: { plugins: [PrimeVue] } })
    await wrapper.find('#password input').setValue('kurz')
    await wrapper.find('#passwordConfirm input').setValue('kurz')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('Das Passwort muss mindestens 8 Zeichen lang sein')
  })

  it('should reject submission if passwords do not match', async () => {
    const wrapper = mount(ResetPasswordView, { global: { plugins: [PrimeVue] } })
    await wrapper.find('#password input').setValue('SicheresPasswort123')
    await wrapper.find('#passwordConfirm input').setValue('AnderesPasswort123')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('Die Passwörter stimmen nicht überein')
  })

  it('should successfully execute password reset', async () => {
    const wrapper = mount(ResetPasswordView, { global: { plugins: [PrimeVue] } })
    vi.mocked(authService.executePasswordReset).mockResolvedValue(undefined)

    await wrapper.find('#password input').setValue('SicheresPasswort123')
    await wrapper.find('#passwordConfirm input').setValue('SicheresPasswort123')
    await wrapper.find('form').trigger('submit.prevent')

    expect(authService.executePasswordReset).toHaveBeenCalledWith({
      email: 'test@verein.at',
      token: '12345',
      password: 'SicheresPasswort123',
    })
    expect(wrapper.text()).toContain('Dein Passwort wurde erfolgreich geändert')
  })

  it('should handle unspecific backend errors safely', async () => {
    const wrapper = mount(ResetPasswordView, { global: { plugins: [PrimeVue] } })

    vi.mocked(authService.executePasswordReset).mockRejectedValueOnce(new Error('Network Error'))

    await wrapper.find('#password input').setValue('SicheresPasswort123')
    await wrapper.find('#passwordConfirm input').setValue('SicheresPasswort123')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('Ein unerwarteter Fehler ist aufgetreten')
  })
})
