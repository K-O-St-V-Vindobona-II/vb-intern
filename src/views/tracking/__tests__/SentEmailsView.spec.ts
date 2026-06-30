import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SentEmailsView from '../SentEmailsView.vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

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
vi.mock('@/services/trackingService', () => ({
  default: {
    getSentEmails: (...args: unknown[]) => mockGetSentEmails(...args),
    getSentEmailDetail: (...args: unknown[]) => mockGetSentEmailDetail(...args),
  },
}))

describe('SentEmailsView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSentEmails.mockResolvedValue({
      items: [
        {
          id: 1,
          created_at: '2026-06-25T12:00:00+00:00',
          to: 'test@vb.at',
          subject: 'Passwort Reset',
          mailer: 'smtp',
        },
      ],
      total: 1,
      page: 1,
      page_size: 25,
    })
  })

  it('renders the email list', async () => {
    const wrapper = mount(SentEmailsView, {
      global: { plugins: [PrimeVue, ToastService] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Versandte Emails')
    expect(wrapper.text()).toContain('Passwort Reset')
    expect(wrapper.text()).toContain('test@vb.at')
  })

  it('uses Dialog component instead of Drawer', async () => {
    mockGetSentEmailDetail.mockResolvedValue({
      id: 1,
      created_at: '2026-06-25T12:00:00+00:00',
      to: 'test@vb.at',
      subject: 'Detail Test',
      body: '<p>Hello</p>',
      mail_from: 'noreply@vb.at',
      mailer: 'smtp',
    })
    const wrapper = mount(SentEmailsView, {
      global: { plugins: [PrimeVue, ToastService] },
    })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'Dialog' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'Drawer' }).exists()).toBe(false)
  })

  it('renders filter controls', async () => {
    const wrapper = mount(SentEmailsView, {
      global: { plugins: [PrimeVue, ToastService] },
    })
    await flushPromises()
    expect(wrapper.find('.filter-bar').exists()).toBe(true)
    expect(wrapper.find('.filter-search').exists()).toBe(true)
  })
})
