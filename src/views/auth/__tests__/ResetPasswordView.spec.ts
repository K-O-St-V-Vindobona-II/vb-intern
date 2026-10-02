import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ResetPasswordView from '../ResetPasswordView.vue'
import PrimeVue from 'primevue/config'
import authService from '@/services/authService'
import type * as VueRouter from 'vue-router'

const mockPush = vi.fn()
const mockRoute: { query: Record<string, string | string[] | null> } = { query: {} }

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof VueRouter>()
  return {
    ...actual,
    useRouter: vi.fn(() => ({ push: mockPush })),
    useRoute: vi.fn(() => mockRoute),
  }
})

vi.mock('@/services/authService')

describe('ResetPasswordView.vue', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    vi.stubEnv('VITE_PASSWORD_MIN_LENGTH', '8')
    vi.clearAllMocks()
    mockRoute.query = { email: 'test@verein.at', token: '12345' }
  })

  it('should refuse short passwords based on env configuration', async () => {
    const wrapper = mount(ResetPasswordView, { global: { plugins: [PrimeVue] } })
    await wrapper.find('input#password').setValue('kurz')
    await wrapper.find('input#passwordConfirm').setValue('kurz')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('Das Passwort muss mindestens 8 Zeichen lang sein')
  })

  it('should reject submission if passwords do not match', async () => {
    const wrapper = mount(ResetPasswordView, { global: { plugins: [PrimeVue] } })
    await wrapper.find('input#password').setValue('SicheresPasswort123')
    await wrapper.find('input#passwordConfirm').setValue('AnderesPasswort123')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('Die Passwörter stimmen nicht überein')
  })

  it('should successfully execute password reset', async () => {
    const wrapper = mount(ResetPasswordView, { global: { plugins: [PrimeVue] } })
    vi.mocked(authService.executePasswordReset).mockResolvedValue(undefined)

    await wrapper.find('input#password').setValue('SicheresPasswort123')
    await wrapper.find('input#passwordConfirm').setValue('SicheresPasswort123')
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

    await wrapper.find('input#password').setValue('SicheresPasswort123')
    await wrapper.find('input#passwordConfirm').setValue('SicheresPasswort123')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('Ein unerwarteter Fehler ist aufgetreten')
  })

  async function submitNewPassword(wrapper: ReturnType<typeof mount>) {
    await wrapper.find('input#password').setValue('SicheresPasswort123')
    await wrapper.find('input#passwordConfirm').setValue('SicheresPasswort123')
    await wrapper.find('form').trigger('submit.prevent')
  }

  it('shows the API detail when the reset is rejected with a text', async () => {
    const wrapper = mount(ResetPasswordView, { global: { plugins: [PrimeVue] } })
    vi.mocked(authService.executePasswordReset).mockRejectedValueOnce({
      response: { data: { detail: 'Der Link ist abgelaufen.' } },
    })

    await submitNewPassword(wrapper)

    expect(wrapper.text()).toContain('Der Link ist abgelaufen.')
  })

  it('shows a readable text, not a serialised list, when the API answers with a validation list', async () => {
    const wrapper = mount(ResetPasswordView, { global: { plugins: [PrimeVue] } })
    vi.mocked(authService.executePasswordReset).mockRejectedValueOnce({
      response: {
        data: {
          detail: [
            { loc: ['body', 'password'], msg: 'Value error, Passwort ist zu häufig verwendet.' },
          ],
        },
      },
    })

    await submitNewPassword(wrapper)

    expect(wrapper.text()).toContain('password: Passwort ist zu häufig verwendet.')
    expect(wrapper.text()).not.toContain('"loc"')
    expect(wrapper.text()).not.toContain('[object Object]')
  })

  it.each([
    ['without a token', { email: 'test@verein.at' }],
    ['without an e-mail address', { token: '12345' }],
    ['with neither', {}],
    ['with an empty token parameter', { email: 'test@verein.at', token: null }],
  ])('reports an incomplete link %s and blocks submitting', async (_label, query) => {
    mockRoute.query = query
    const wrapper = mount(ResetPasswordView, { global: { plugins: [PrimeVue] } })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Der Link ist ungültig oder unvollständig')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('uses the first value of a repeated query parameter instead of an array', async () => {
    mockRoute.query = { email: ['test@verein.at', 'other@verein.at'], token: ['12345', '99999'] }
    const wrapper = mount(ResetPasswordView, { global: { plugins: [PrimeVue] } })
    vi.mocked(authService.executePasswordReset).mockResolvedValue(undefined)

    await submitNewPassword(wrapper)

    expect(authService.executePasswordReset).toHaveBeenCalledWith({
      email: 'test@verein.at',
      token: '12345',
      password: 'SicheresPasswort123',
    })
  })

  it('points the labels at the inputs and marks both fields as new passwords', () => {
    const wrapper = mount(ResetPasswordView, { global: { plugins: [PrimeVue] } })

    for (const label of wrapper.findAll('label')) {
      expect(wrapper.find(`#${label.attributes('for')}`).element.tagName).toBe('INPUT')
    }
    expect(wrapper.find('input#password').attributes('autocomplete')).toBe('new-password')
    expect(wrapper.find('input#passwordConfirm').attributes('autocomplete')).toBe('new-password')
  })

  it('renders both password fields at full width like the sign-in form', () => {
    const wrapper = mount(ResetPasswordView, { global: { plugins: [PrimeVue] } })

    const fields = wrapper.findAllComponents({ name: 'Password' })
    expect(fields).toHaveLength(2)
    expect(fields.map((f) => f.props('fluid'))).toEqual([true, true])
  })
})
