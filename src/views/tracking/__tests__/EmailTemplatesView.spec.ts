import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import EmailTemplatesView from '../EmailTemplatesView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
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

const mountOpts = { global: { plugins: [PrimeVue, ToastService] } }

function previewButtons(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-pc-name="button"]').filter((b) => b.find('.pi-eye').exists())
}

function deferredPreview() {
  let resolvePromise!: (value: unknown) => void
  let rejectPromise!: (reason: unknown) => void
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

describe('EmailTemplatesView.vue', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

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
    const wrapper = mount(EmailTemplatesView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('Passwort zurücksetzen')
    expect(wrapper.text()).toContain('Datenbankänderung')
    expect(wrapper.text()).toContain('AH-Kassen Abrechnung')
  })

  it('shows source location for each template', async () => {
    const wrapper = mount(EmailTemplatesView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('mailer.py → send_reset_email()')
    expect(wrapper.text()).toContain('p4x_service.py → send_summary_email()')
  })

  it('shows the number of templates and the sum of their sends', async () => {
    const wrapper = mount(EmailTemplatesView, mountOpts)
    await flushPromises()

    const values = wrapper.findAll('.stat-value').map((v) => v.text())
    expect(values).toEqual(['3', '17'])
  })

  it('groups the thousands of the sum with the German separator', async () => {
    mockGetTemplates.mockResolvedValue([
      {
        template_key: 'chronicles',
        template_name: 'Chronik',
        source_location: 'mailer.py',
        count: 12345,
        last_sent: null,
      },
    ])
    const wrapper = mount(EmailTemplatesView, mountOpts)
    await flushPromises()

    expect(wrapper.findAll('.stat-value')[1]?.text()).toBe((12345).toLocaleString('de-AT'))
  })

  it('shows a dash in the last-sent column of a template that was never sent', async () => {
    const wrapper = mount(EmailTemplatesView, mountOpts)
    await flushPromises()

    const row = wrapper.findAll('tbody tr').find((r) => r.text().includes('AH-Kassen Abrechnung'))
    expect(row?.findAll('td')[2]?.text()).toBe('-')
  })

  it('shows the date of the last send for a template that was sent', async () => {
    vi.stubEnv('TZ', 'Europe/Vienna')
    const wrapper = mount(EmailTemplatesView, mountOpts)
    await flushPromises()

    const row = wrapper.findAll('tbody tr').find((r) => r.text().includes('Passwort zurücksetzen'))
    expect(row?.findAll('td')[2]?.text()).toBe('25.06.2026, 16:00')
  })

  it('lists the template with the most sends first', async () => {
    const wrapper = mount(EmailTemplatesView, mountOpts)
    await flushPromises()

    const firstRow = wrapper.findAll('tbody tr')[0]
    expect(firstRow?.text()).toContain('Datenbankänderung')
  })

  it('uses the retention_months from the config endpoint', async () => {
    mockGetConfig.mockResolvedValue({ retention_months: 12 })
    const wrapper = mount(EmailTemplatesView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('letzten 12 Monate')
  })

  it('falls back to six months when the config request fails', async () => {
    mockGetConfig.mockRejectedValue(new Error('boom'))
    const wrapper = mount(EmailTemplatesView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('letzten 6 Monate')
    expect(mockGetTemplates).toHaveBeenCalledOnce()
  })

  it('shows a toast when loading the templates fails', async () => {
    mockGetTemplates.mockRejectedValue(new Error('boom'))
    mount(EmailTemplatesView, mountOpts)
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('renders a preview button for each template', async () => {
    const wrapper = mount(EmailTemplatesView, mountOpts)
    await flushPromises()

    expect(previewButtons(wrapper).length).toBe(3)
  })

  it('names each preview button after its template for assistive technology', async () => {
    const wrapper = mount(EmailTemplatesView, mountOpts)
    await flushPromises()

    const labels = previewButtons(wrapper).map((b) => b.attributes('aria-label'))
    expect(labels).toContain('Vorschau: Passwort zurücksetzen')
    expect(labels).toContain('Vorschau: Datenbankänderung')
    expect(labels).toContain('Vorschau: AH-Kassen Abrechnung')
  })

  describe('preview', () => {
    it('requests the preview of the clicked template', async () => {
      const wrapper = mount(EmailTemplatesView, mountOpts)
      await flushPromises()

      await previewButtons(wrapper)[0]!.trigger('click')
      await flushPromises()

      expect(mockGetPreview).toHaveBeenCalledOnce()
      expect(mockGetPreview).toHaveBeenCalledWith('entry-changed')
    })

    it('shows the rendered mail in a frame without any sandbox permission', async () => {
      const wrapper = mount(EmailTemplatesView, mountOpts)
      await flushPromises()

      await previewButtons(wrapper)[0]!.trigger('click')
      await flushPromises()

      const frame = document.body.querySelector('iframe')
      expect(document.body.textContent).toContain('Vorschau: Datenbankänderung')
      expect(frame?.getAttribute('srcdoc')).toBe('<p>Preview content</p>')
      // An empty sandbox attribute is the security control: no scripts, forms or
      // same-origin access for the HTML of a mail template.
      expect(frame?.getAttribute('sandbox')).toBe('')
    })

    it('shows a toast and closes the dialog when the preview cannot be loaded', async () => {
      mockGetPreview.mockRejectedValue(new Error('boom'))
      const wrapper = mount(EmailTemplatesView, mountOpts)
      await flushPromises()

      await previewButtons(wrapper)[0]!.trigger('click')
      await flushPromises()

      expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
      expect(document.body.querySelector('iframe')).toBeNull()
      expect(document.body.textContent).not.toContain('Vorschau: Datenbankänderung')
    })

    it('hides the mail of the previously opened template while the next one loads', async () => {
      const wrapper = mount(EmailTemplatesView, mountOpts)
      await flushPromises()
      await previewButtons(wrapper)[0]!.trigger('click')
      await flushPromises()
      expect(document.body.querySelector('iframe')).not.toBeNull()
      mockGetPreview.mockReturnValueOnce(new Promise(() => {}))

      await previewButtons(wrapper)[1]!.trigger('click')
      await flushPromises()

      expect(document.body.textContent).toContain('Lade Vorschau')
      expect(document.body.querySelector('iframe')).toBeNull()
    })

    it('regression: a slow answer for an earlier template does not replace the newer preview', async () => {
      const slow = deferredPreview()
      mockGetPreview
        .mockReturnValueOnce(slow.promise)
        .mockResolvedValueOnce({ html: '<p>Newer mail</p>' })
      const wrapper = mount(EmailTemplatesView, mountOpts)
      await flushPromises()

      await previewButtons(wrapper)[0]!.trigger('click')
      await previewButtons(wrapper)[1]!.trigger('click')
      await flushPromises()
      slow.resolve({ html: '<p>Stale mail</p>' })
      await flushPromises()

      expect(document.body.querySelector('iframe')?.getAttribute('srcdoc')).toBe(
        '<p>Newer mail</p>',
      )
    })

    it('regression: a slow answer for an earlier template does not end the loading state of the newer one', async () => {
      const slow = deferredPreview()
      mockGetPreview.mockReturnValueOnce(slow.promise).mockReturnValueOnce(new Promise(() => {}))
      const wrapper = mount(EmailTemplatesView, mountOpts)
      await flushPromises()

      await previewButtons(wrapper)[0]!.trigger('click')
      await previewButtons(wrapper)[1]!.trigger('click')
      slow.resolve({ html: '<p>Stale mail</p>' })
      await flushPromises()

      expect(document.body.textContent).toContain('Lade Vorschau')
      expect(document.body.querySelector('iframe')).toBeNull()
    })

    it('regression: a late failure of an earlier template neither toasts nor closes the newer dialog', async () => {
      const slow = deferredPreview()
      mockGetPreview
        .mockReturnValueOnce(slow.promise)
        .mockResolvedValueOnce({ html: '<p>Newer mail</p>' })
      const wrapper = mount(EmailTemplatesView, mountOpts)
      await flushPromises()

      await previewButtons(wrapper)[0]!.trigger('click')
      await previewButtons(wrapper)[1]!.trigger('click')
      await flushPromises()
      slow.reject(new Error('boom'))
      await flushPromises()

      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(document.body.querySelector('iframe')?.getAttribute('srcdoc')).toBe(
        '<p>Newer mail</p>',
      )
    })
  })
})
