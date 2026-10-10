import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileView from '../ProfileView.vue'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'

const mockUnlink = vi.fn()
const mockAuthStore = {
  user: {
    vorname: 'Max',
    nachname: 'Mustermann',
    email: 'test@test.at',
    couleurname: 'Kopernikus',
    org_id: 'vbw',
    google_linked: true,
    chroniclemail: false,
    permissions: ['archiveAdmin', 'p4xView'],
  },
  unlinkGoogle: mockUnlink,
}

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

const mockConfirmRequire = vi.fn()
vi.mock('primevue/useconfirm', () => ({
  useConfirm: vi.fn(() => ({ require: mockConfirmRequire })),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockToggleChronicleMail = vi.fn()
vi.mock('@/services/memberService', () => ({
  default: { toggleChronicleMail: (...args: unknown[]) => mockToggleChronicleMail(...args) },
}))

const mockGetEnvironment = vi.fn()
vi.mock('@/services/systemService', () => ({
  default: { getEnvironment: (...args: unknown[]) => mockGetEnvironment(...args) },
}))

vi.mock('@/runtimeConfig', () => ({
  appEnvironment: vi.fn(() => 'qa'),
}))

const mountOpts = {
  global: {
    plugins: [PrimeVue, ConfirmationService, ToastService],
    stubs: { ConfirmDialog: true },
  },
}

describe('ProfileView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user.google_linked = true
    mockAuthStore.user.chroniclemail = false
    mockAuthStore.user.permissions = ['archiveAdmin', 'p4xView']
    mockAuthStore.user.couleurname = 'Kopernikus'
    mockToggleChronicleMail.mockResolvedValue(true)
    mockGetEnvironment.mockResolvedValue({ data: { environment: 'production' } })
  })

  it('should display user profile data', () => {
    const wrapper = mount(ProfileView, mountOpts)
    expect(wrapper.text()).toContain('Kopernikus')
    expect(wrapper.text()).toContain('VBW')
    expect(wrapper.text()).toContain('archiveAdmin')
    expect(wrapper.text()).toContain('p4xView')
  })

  it('should indicate Google connection and trigger unlink confirmation on button click', async () => {
    const wrapper = mount(ProfileView, mountOpts)
    expect(wrapper.text()).toContain('verbunden')

    const unlinkBtn = wrapper.findAll('button').find((b) => b.text().includes('Verknüpfung lösen'))
    await unlinkBtn!.trigger('click')

    expect(mockConfirmRequire).toHaveBeenCalledOnce()
    mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockUnlink).toHaveBeenCalledOnce()
  })

  it('should abort unlinking if the user declines the confirmation dialog', async () => {
    const wrapper = mount(ProfileView, mountOpts)

    const unlinkBtn = wrapper.findAll('button').find((b) => b.text().includes('Verknüpfung lösen'))
    await unlinkBtn!.trigger('click')

    const confirmArgs = mockConfirmRequire.mock.calls[0]![0]
    if (confirmArgs.reject) confirmArgs.reject()

    expect(mockUnlink).not.toHaveBeenCalled()
  })

  it('should show an error toast if the unlinking API call fails', async () => {
    mockUnlink.mockRejectedValueOnce(new Error('Backend error'))
    const wrapper = mount(ProfileView, mountOpts)

    const unlinkBtn = wrapper.findAll('button').find((b) => b.text().includes('Verknüpfung lösen'))
    await unlinkBtn!.trigger('click')

    mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('shows the frontend and backend stage discreetly at the bottom of the page', async () => {
    const wrapper = mount(ProfileView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('Frontend: qa')
    expect(wrapper.text()).toContain('Backend: production')
  })

  it('omits the backend stage line if the fetch fails', async () => {
    mockGetEnvironment.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mount(ProfileView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('Frontend: qa')
    expect(wrapper.text()).not.toContain('Backend:')
  })

  const buttonByText = (wrapper: ReturnType<typeof mount>, text: string) =>
    wrapper.findAll('button').find((b) => b.text() === text)

  it('shows first name, last name, e-mail and organisation in their own fields', () => {
    const wrapper = mount(ProfileView, mountOpts)

    const fields = Object.fromEntries(
      wrapper
        .findAll('.info-item')
        .map((item) => [item.find('.info-label').text(), item.find('.info-value').text()]),
    )
    expect(fields).toEqual({
      Vorname: 'Max',
      Nachname: 'Mustermann',
      Couleurname: 'Kopernikus',
      'E-Mail': 'test@test.at',
      Organisation: 'VBW',
    })
  })

  it('omits the Couleurname field when the member has none', () => {
    mockAuthStore.user.couleurname = ''
    const wrapper = mount(ProfileView, mountOpts)

    expect(wrapper.text()).not.toContain('Couleurname')
  })

  it('says so when the member has no permissions', () => {
    mockAuthStore.user.permissions = []
    const wrapper = mount(ProfileView, mountOpts)

    expect(wrapper.text()).toContain('Keine speziellen Berechtigungen zugewiesen.')
    expect(wrapper.find('.permissions-grid').exists()).toBe(false)
  })

  it('offers no unlink button and explains the link when Google is not connected', () => {
    mockAuthStore.user.google_linked = false
    const wrapper = mount(ProfileView, mountOpts)

    expect(wrapper.text()).toContain('nicht verbunden')
    expect(wrapper.text()).toContain('Du kannst dein Google-Konto beim nächsten Login verknüpfen.')
    expect(buttonByText(wrapper, 'Verknüpfung lösen')).toBeUndefined()
  })

  it('names what the unlink confirmation is about and reports a successful unlink', async () => {
    const wrapper = mount(ProfileView, mountOpts)

    await buttonByText(wrapper, 'Verknüpfung lösen')!.trigger('click')
    const options = mockConfirmRequire.mock.calls[0]![0]
    expect(options.header).toBe('Verknüpfung lösen')
    expect(options.message).toContain('wirklich lösen')
    await options.accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Google-Verknüpfung wurde entfernt.',
      }),
    )
  })

  describe('chronicle e-mails', () => {
    it('shows the state and offers to switch it on when it is off', () => {
      const wrapper = mount(ProfileView, mountOpts)

      expect(wrapper.find('.status-inactive').text()).toBe('deaktiviert')
      expect(buttonByText(wrapper, 'Aktivieren')).toBeDefined()
    })

    it('switches it on, shows the new state and reports it', async () => {
      const wrapper = mount(ProfileView, mountOpts)

      await buttonByText(wrapper, 'Aktivieren')!.trigger('click')
      await flushPromises()

      expect(mockToggleChronicleMail).toHaveBeenCalledOnce()
      expect(mockAuthStore.user.chroniclemail).toBe(true)
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'Chronik-Emails aktiviert.' }),
      )
    })

    it('reports a switch-off with its own text', async () => {
      mockAuthStore.user.chroniclemail = true
      mockToggleChronicleMail.mockResolvedValue(false)
      const wrapper = mount(ProfileView, mountOpts)
      expect(wrapper.find('.status-active').text()).toBe('aktiviert')

      await buttonByText(wrapper, 'Deaktivieren')!.trigger('click')
      await flushPromises()

      expect(mockAuthStore.user.chroniclemail).toBe(false)
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ summary: 'Chronik-Emails deaktiviert.' }),
      )
    })

    it('keeps the state and shows an error when the switch fails', async () => {
      mockToggleChronicleMail.mockRejectedValue(new Error('boom'))
      const wrapper = mount(ProfileView, mountOpts)

      await buttonByText(wrapper, 'Aktivieren')!.trigger('click')
      await flushPromises()

      expect(mockAuthStore.user.chroniclemail).toBe(false)
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', summary: 'Fehler beim Umschalten.' }),
      )
    })
  })

  it('names the failure of the unlink in the toast text', async () => {
    mockUnlink.mockRejectedValueOnce(new Error('Backend error'))
    const wrapper = mount(ProfileView, mountOpts)

    await buttonByText(wrapper, 'Verknüpfung lösen')!.trigger('click')
    await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'Fehler beim Lösen der Verknüpfung.',
      }),
    )
  })

  it('labels the two answers of the unlink confirmation', async () => {
    const wrapper = mount(ProfileView, mountOpts)

    await buttonByText(wrapper, 'Verknüpfung lösen')!.trigger('click')

    const options = mockConfirmRequire.mock.calls[0]![0]
    expect(options.rejectProps.label).toBe('Abbrechen')
    expect(options.acceptProps.label).toBe('Ja, Verknüpfung lösen')
  })

  it.each([
    ['the unlink', 'Verknüpfung lösen'],
    ['the chronicle switch', 'Aktivieren'],
  ])('lets the button of %s be used again after it has finished', async (_name, label) => {
    const wrapper = mount(ProfileView, mountOpts)
    const button = buttonByText(wrapper, label)!

    await button.trigger('click')
    if (label === 'Verknüpfung lösen') await mockConfirmRequire.mock.calls[0]![0].accept()
    await flushPromises()

    expect(buttonByText(wrapper, label)?.attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.p-button-loading').exists()).toBe(false)
  })
})
