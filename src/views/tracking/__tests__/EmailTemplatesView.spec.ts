import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EmailTemplatesView from '../EmailTemplatesView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

const mockGetTemplates = vi.fn()
const mockGetPreview = vi.fn()
const mockGetConfig = vi.fn()
vi.mock('@/services/trackingService', () => ({
  default: {
    getEmailTemplates: (...args: unknown[]) => mockGetTemplates(...args),
    getTemplatePreview: (...args: unknown[]) => mockGetPreview(...args),
    getConfig: (...args: unknown[]) => mockGetConfig(...args),
  },
}))

describe('EmailTemplatesView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetConfig.mockResolvedValue({ retention_months: 6 })
    mockGetPreview.mockResolvedValue({
      template_key: 'password-reset',
      template_name: 'Passwort zurücksetzen',
      html: '<p>Preview content</p>',
    })
    mockGetTemplates.mockResolvedValue([
      {
        template_key: 'password-reset',
        template_name: 'Passwort zurücksetzen',
        source_location: 'mailer.py → send_reset_email()',
        count: 5,
        last_sent: '2026-06-25T14:00:00+00:00',
      },
      {
        template_key: 'entry-changed',
        template_name: 'Datenbankänderung',
        source_location: 'mailer.py → send_entry_changed_email()',
        count: 12,
        last_sent: '2026-06-24T10:00:00+00:00',
      },
      {
        template_key: 'p4x-summary',
        template_name: 'AH-Kassen Abrechnung',
        source_location: 'p4x_service.py → send_summary_email()',
        count: 0,
        last_sent: null,
      },
    ])
  })

  it('renders all three registry entries', async () => {
    const wrapper = mount(EmailTemplatesView, {
      global: { plugins: [PrimeVue, ToastService] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Passwort zurücksetzen')
    expect(wrapper.text()).toContain('Datenbankänderung')
    expect(wrapper.text()).toContain('AH-Kassen Abrechnung')
  })

  it('shows source location for each template', async () => {
    const wrapper = mount(EmailTemplatesView, {
      global: { plugins: [PrimeVue, ToastService] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('mailer.py → send_reset_email()')
    expect(wrapper.text()).toContain('p4x_service.py → send_summary_email()')
  })

  it('displays correct stats', async () => {
    const wrapper = mount(EmailTemplatesView, {
      global: { plugins: [PrimeVue, ToastService] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('17')
  })

  it('shows dash for templates with no sends', async () => {
    const wrapper = mount(EmailTemplatesView, {
      global: { plugins: [PrimeVue, ToastService] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('-')
  })

  it('renders preview buttons for each template', async () => {
    const wrapper = mount(EmailTemplatesView, {
      global: { plugins: [PrimeVue, ToastService] },
    })
    await flushPromises()
    const previewButtons = wrapper.findAll('[data-pc-name="button"]')
    const eyeButtons = previewButtons.filter((b) => b.find('.pi-eye').exists())
    expect(eyeButtons.length).toBe(3)
  })

  it('calls getTemplatePreview on preview button click', async () => {
    const wrapper = mount(EmailTemplatesView, {
      global: { plugins: [PrimeVue, ToastService] },
    })
    await flushPromises()
    const eyeButtons = wrapper
      .findAll('[data-pc-name="button"]')
      .filter((b) => b.find('.pi-eye').exists())
    await eyeButtons[0].trigger('click')
    await flushPromises()
    expect(mockGetPreview).toHaveBeenCalledOnce()
  })
})
