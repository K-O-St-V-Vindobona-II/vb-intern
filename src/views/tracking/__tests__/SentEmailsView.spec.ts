import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SentEmailsView from '../SentEmailsView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import type { SentEmailListItem, SentEmailDetail } from '@/types/tracking'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

const mockGetSentEmails = vi.fn()
const mockGetSentEmailDetail = vi.fn()
const mockGetConfig = vi.fn()
vi.mock('@/services/trackingService', () => ({
  default: {
    getSentEmails: (...args: unknown[]) => mockGetSentEmails(...args),
    getSentEmailDetail: (...args: unknown[]) => mockGetSentEmailDetail(...args),
    getConfig: (...args: unknown[]) => mockGetConfig(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const EMAIL_ID_A = '11111111-1111-1111-1111-111111111111'
const EMAIL_ID_B = '22222222-2222-2222-2222-222222222222'

function buildItem(overrides: Partial<SentEmailListItem> = {}): SentEmailListItem {
  return {
    id: EMAIL_ID_A,
    created_at: '2026-06-25T12:00:00+00:00',
    to: 'test@vb.at',
    subject: 'Passwort Reset',
    mailer: 'smtp',
    ...overrides,
  }
}

function buildDetail(overrides: Partial<SentEmailDetail> = {}): SentEmailDetail {
  return {
    ...buildItem(),
    subject: 'Detail Test',
    body: '<p>Hello</p>',
    mail_from: 'noreply@vb.at',
    cc: null,
    bcc: null,
    headers: null,
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue, ToastService] }, attachTo: document.body }

describe('SentEmailsView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSentEmails.mockResolvedValue({ items: [buildItem()], total: 1, page: 1, page_size: 25 })
    mockGetConfig.mockResolvedValue({ retention_months: 6 })
  })

  it('renders the email list', async () => {
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('Versandte Emails')
    expect(wrapper.text()).toContain('Passwort Reset')
    expect(wrapper.text()).toContain('test@vb.at')
    wrapper.unmount()
  })

  it('uses Dialog component instead of Drawer', async () => {
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    expect(wrapper.findComponent({ name: 'Dialog' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'Drawer' }).exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders filter controls', async () => {
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    expect(wrapper.find('.filter-bar').exists()).toBe(true)
    expect(wrapper.find('.filter-search').exists()).toBe(true)
    wrapper.unmount()
  })

  it('uses the retention_months from the config endpoint', async () => {
    mockGetConfig.mockResolvedValue({ retention_months: 3 })
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('letzten 3 Monate')
    wrapper.unmount()
  })

  it('falls back to the default retention when the config request fails', async () => {
    mockGetConfig.mockRejectedValue(new Error('boom'))
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('letzten 6 Monate')
    wrapper.unmount()
  })

  it('shows an error toast when loading emails fails', async () => {
    mockGetSentEmails.mockRejectedValue(new Error('boom'))
    mount(SentEmailsView, mountOpts)
    await flushPromises()
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('shows the smtp tag with success severity and others with info', async () => {
    mockGetSentEmails.mockResolvedValue({
      items: [
        buildItem({ id: EMAIL_ID_A, mailer: 'smtp' }),
        buildItem({ id: EMAIL_ID_B, mailer: 'sendmail' }),
      ],
      total: 2,
      page: 1,
      page_size: 25,
    })
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const tags = wrapper.findAllComponents({ name: 'Tag' })
    expect(tags.find((t) => t.props('value') === 'smtp')?.props('severity')).toBe('success')
    expect(tags.find((t) => t.props('value') === 'sendmail')?.props('severity')).toBe('info')
    wrapper.unmount()
  })

  it('shows the detail dialog with CC/BCC when a row is clicked', async () => {
    mockGetSentEmailDetail.mockResolvedValue(buildDetail({ cc: 'cc@vb.at', bcc: 'bcc@vb.at' }))
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const table = wrapper.findComponent({ name: 'DataTable' })
    await table.vm.$emit('row-click', { data: buildItem() })
    await flushPromises()

    expect(mockGetSentEmailDetail).toHaveBeenCalledWith(EMAIL_ID_A)
    expect(document.body.textContent).toContain('cc@vb.at')
    expect(document.body.textContent).toContain('bcc@vb.at')
    wrapper.unmount()
  })

  it('shows a fallback message when the email body is empty', async () => {
    mockGetSentEmailDetail.mockResolvedValue(buildDetail({ body: null }))
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const table = wrapper.findComponent({ name: 'DataTable' })
    await table.vm.$emit('row-click', { data: buildItem() })
    await flushPromises()

    expect(document.body.textContent).toContain('(Kein Inhalt)')
    wrapper.unmount()
  })

  it('shows an error toast when loading the detail fails', async () => {
    mockGetSentEmailDetail.mockRejectedValue(new Error('boom'))
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const table = wrapper.findComponent({ name: 'DataTable' })
    await table.vm.$emit('row-click', { data: buildItem() })
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    wrapper.unmount()
  })

  it('requests the next page', async () => {
    mockGetSentEmails.mockResolvedValue({ items: [], total: 60, page: 1, page_size: 25 })
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const table = wrapper.findComponent({ name: 'DataTable' })
    await table.vm.$emit('page', { page: 1 })
    await flushPromises()

    expect(mockGetSentEmails).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    wrapper.unmount()
  })

  it('resets to page 1 and includes the trimmed search term when searching', async () => {
    mockGetSentEmails.mockResolvedValue({ items: [], total: 60, page: 1, page_size: 25 })
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const table = wrapper.findComponent({ name: 'DataTable' })
    await table.vm.$emit('page', { page: 1 })
    await flushPromises()
    expect(mockGetSentEmails).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))

    const searchInput = wrapper.find('input[placeholder="Suche (Betreff, Empfänger)..."]')
    await searchInput.setValue('  Reset  ')
    await flushPromises()

    expect(mockGetSentEmails).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, search: 'Reset' }),
    )
    wrapper.unmount()
  })

  it('does not include an empty search term', async () => {
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    mockGetSentEmails.mockClear()

    const searchInput = wrapper.find('input[placeholder="Suche (Betreff, Empfänger)..."]')
    await searchInput.setValue('   ')
    await flushPromises()

    const call = mockGetSentEmails.mock.calls.at(-1)?.[0]
    expect(call).not.toHaveProperty('search')
    wrapper.unmount()
  })

  it('offers only months up to the retention cutoff for the selected year', async () => {
    mockGetConfig.mockResolvedValue({ retention_months: 2 })
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const yearSelect = wrapper.findComponent({ name: 'Select' })
    const years = yearSelect.props('options') as { label: string; value: number }[]
    expect(years.length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('shows only "Alle Monate" before a year is selected', async () => {
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const monthSelect = wrapper.findAllComponents({ name: 'Select' })[1]!
    expect(monthSelect.props('options')).toEqual([{ label: 'Alle Monate', value: null }])
    wrapper.unmount()
  })

  it('reloads with the selected year and month', async () => {
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    mockGetSentEmails.mockClear()

    const yearSelect = wrapper.findComponent({ name: 'Select' })
    const year = (yearSelect.props('options') as { value: number }[])[0]!.value
    await yearSelect.vm.$emit('update:modelValue', year)
    await flushPromises()

    expect(mockGetSentEmails).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, year }))
    wrapper.unmount()
  })
})
