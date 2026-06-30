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

vi.mock('@/services/memberService', () => ({
  default: { toggleChronicleMail: vi.fn(() => Promise.resolve(true)) },
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
    mockConfirmRequire.mock.calls[0][0].accept()
    await flushPromises()

    expect(mockUnlink).toHaveBeenCalledOnce()
  })

  it('should abort unlinking if the user declines the confirmation dialog', async () => {
    const wrapper = mount(ProfileView, mountOpts)

    const unlinkBtn = wrapper.findAll('button').find((b) => b.text().includes('Verknüpfung lösen'))
    await unlinkBtn!.trigger('click')

    const confirmArgs = mockConfirmRequire.mock.calls[0][0]
    if (confirmArgs.reject) confirmArgs.reject()

    expect(mockUnlink).not.toHaveBeenCalled()
  })

  it('should show an error toast if the unlinking API call fails', async () => {
    mockUnlink.mockRejectedValueOnce(new Error('Backend error'))
    const wrapper = mount(ProfileView, mountOpts)

    const unlinkBtn = wrapper.findAll('button').find((b) => b.text().includes('Verknüpfung lösen'))
    await unlinkBtn!.trigger('click')

    mockConfirmRequire.mock.calls[0][0].accept()
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })
})
