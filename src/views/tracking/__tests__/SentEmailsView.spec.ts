import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

// The search waits for a pause in typing; only the timer functions are faked so that
// flushPromises keeps working.
async function typingPause() {
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
}

const listAnswer = (items: SentEmailListItem[], total = items.length) => ({
  items,
  total,
  page: 1,
  page_size: 25,
})

function deferredAnswer<T>() {
  let resolvePromise!: (value: T) => void
  let rejectPromise!: (reason: unknown) => void
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

describe('SentEmailsView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mockGetSentEmails.mockResolvedValue({ items: [buildItem()], total: 1, page: 1, page_size: 25 })
    mockGetConfig.mockResolvedValue({ retention_months: 6 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the email list', async () => {
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('Versandte Emails')
    expect(wrapper.text()).toContain('Passwort Reset')
    expect(wrapper.text()).toContain('test@vb.at')
  })

  it('uses Dialog component instead of Drawer', async () => {
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    expect(wrapper.findComponent({ name: 'Dialog' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'Drawer' }).exists()).toBe(false)
  })

  it('renders filter controls', async () => {
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    expect(wrapper.find('.filter-bar').exists()).toBe(true)
    expect(wrapper.find('.filter-search').exists()).toBe(true)
  })

  it('uses the retention_months from the config endpoint', async () => {
    mockGetConfig.mockResolvedValue({ retention_months: 3 })
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('letzten 3 Monate')
  })

  it('falls back to the default retention when the config request fails', async () => {
    mockGetConfig.mockRejectedValue(new Error('boom'))
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    expect(wrapper.text()).toContain('letzten 6 Monate')
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
  })

  it('shows a fallback message when the email body is empty', async () => {
    mockGetSentEmailDetail.mockResolvedValue(buildDetail({ body: null }))
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const table = wrapper.findComponent({ name: 'DataTable' })
    await table.vm.$emit('row-click', { data: buildItem() })
    await flushPromises()

    expect(document.body.textContent).toContain('(Kein Inhalt)')
  })

  it('shows an error toast when loading the detail fails', async () => {
    mockGetSentEmailDetail.mockRejectedValue(new Error('boom'))
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const table = wrapper.findComponent({ name: 'DataTable' })
    await table.vm.$emit('row-click', { data: buildItem() })
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('requests the next page', async () => {
    mockGetSentEmails.mockResolvedValue({ items: [], total: 60, page: 1, page_size: 25 })
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const table = wrapper.findComponent({ name: 'DataTable' })
    await table.vm.$emit('page', { page: 1, rows: 25 })
    await flushPromises()

    expect(mockGetSentEmails).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
  })

  it('resets to page 1 and includes the trimmed search term when searching', async () => {
    mockGetSentEmails.mockResolvedValue({ items: [], total: 60, page: 1, page_size: 25 })
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const table = wrapper.findComponent({ name: 'DataTable' })
    await table.vm.$emit('page', { page: 1, rows: 25 })
    await flushPromises()
    expect(mockGetSentEmails).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))

    const searchInput = wrapper.find('input[placeholder="Suche (Betreff, Empfänger)..."]')
    await searchInput.setValue('  Reset  ')
    await typingPause()

    expect(mockGetSentEmails).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, search: 'Reset' }),
    )
  })

  it('does not include an empty search term', async () => {
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    mockGetSentEmails.mockClear()

    const searchInput = wrapper.find('input[placeholder="Suche (Betreff, Empfänger)..."]')
    await searchInput.setValue('   ')
    await typingPause()

    const call = mockGetSentEmails.mock.calls.at(-1)?.[0]
    expect(call).not.toHaveProperty('search')
  })

  it('offers only the months inside the retention window for the selected year', async () => {
    mockGetConfig.mockResolvedValue({ retention_months: 2 })
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()
    const now = new Date()
    const window = [2, 1, 0].map((back) => new Date(now.getFullYear(), now.getMonth() - back, 1))

    const [yearSelect, monthSelect] = wrapper.findAllComponents({ name: 'Select' })
    const years = (yearSelect!.props('options') as { value: number }[]).map((y) => y.value)
    expect(years).toEqual([...new Set(window.map((d) => d.getFullYear()))])

    await yearSelect!.vm.$emit('update:modelValue', years[0])
    await flushPromises()
    const months = (monthSelect!.props('options') as { value: number | null }[]).map((m) => m.value)
    expect(months).toEqual([
      null,
      ...window.filter((d) => d.getFullYear() === years[0]).map((d) => d.getMonth() + 1),
    ])
  })

  it('shows only "Alle Monate" before a year is selected', async () => {
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const monthSelect = wrapper.findAllComponents({ name: 'Select' })[1]!
    expect(monthSelect.props('options')).toEqual([{ label: 'Alle Monate', value: null }])
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
  })

  it('names the filters for assistive technology', async () => {
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const comboboxLabels = wrapper
      .findAll('.filter-bar [role="combobox"]')
      .map((c) => c.attributes('aria-label'))
    expect(comboboxLabels).toEqual(['Jahr', 'Monat'])
    // PrimeVue falls back to the placeholder as the name, so ask the property itself.
    const filterSelects = wrapper.findAllComponents({ name: 'Select' }).slice(0, 2)
    expect(filterSelects.map((s) => s.props('ariaLabel'))).toEqual(['Jahr', 'Monat'])
    expect(wrapper.find('input.filter-search').attributes('aria-label')).toBe(
      'Suche in Betreff und Empfänger',
    )
  })

  it('widens the year list to the configured retention', async () => {
    mockGetConfig.mockResolvedValue({ retention_months: 14 })
    const wrapper = mount(SentEmailsView, mountOpts)
    await flushPromises()

    const years = wrapper.findComponent({ name: 'Select' }).props('options') as { value: number }[]
    expect(years.map((y) => y.value)).toEqual([
      new Date().getFullYear() - 1,
      new Date().getFullYear(),
    ])
  })

  describe('paging', () => {
    function rowsPerPageSelect(wrapper: ReturnType<typeof mount>) {
      const selects = wrapper.findAllComponents({ name: 'Select' })
      return selects[selects.length - 1]!
    }

    it('regression: the chosen page size is requested and shown', async () => {
      mockGetSentEmails.mockResolvedValue(listAnswer([buildItem()], 500))
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()

      await rowsPerPageSelect(wrapper).vm.$emit('update:modelValue', 50)
      await flushPromises()

      expect(mockGetSentEmails).toHaveBeenLastCalledWith({ page: 1, page_size: 50 })
      expect(wrapper.findComponent({ name: 'DataTable' }).props('rows')).toBe(50)
    })

    it('regression: a later page is requested with the chosen page size', async () => {
      mockGetSentEmails.mockResolvedValue(listAnswer([buildItem()], 500))
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()

      const table = wrapper.findComponent({ name: 'DataTable' })
      await table.vm.$emit('page', { page: 2, rows: 50 })
      await flushPromises()

      expect(mockGetSentEmails).toHaveBeenLastCalledWith({ page: 3, page_size: 50 })
      expect(table.props('first')).toBe(100)
    })

    it('regression: the paginator returns to the first page when the filter changes', async () => {
      mockGetSentEmails.mockResolvedValue(listAnswer([buildItem()], 500))
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()
      const table = wrapper.findComponent({ name: 'DataTable' })
      await table.vm.$emit('page', { page: 2, rows: 25 })
      await flushPromises()
      expect(wrapper.findComponent({ name: 'Paginator' }).props('first')).toBe(50)

      await wrapper.find('input.filter-search').setValue('Reset')
      await typingPause()

      expect(mockGetSentEmails).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 25,
        search: 'Reset',
      })
      expect(wrapper.findComponent({ name: 'Paginator' }).props('first')).toBe(0)
    })
  })

  describe('filters', () => {
    async function selectYearAndMonth(wrapper: ReturnType<typeof mount>) {
      const [yearSelect, monthSelect] = wrapper.findAllComponents({ name: 'Select' })
      const years = yearSelect!.props('options') as { value: number }[]
      await yearSelect!.vm.$emit('update:modelValue', years[0]!.value)
      await flushPromises()
      const months = monthSelect!.props('options') as { value: number | null }[]
      await monthSelect!.vm.$emit('update:modelValue', months[1]!.value)
      await flushPromises()
      return { yearSelect: yearSelect!, monthSelect: monthSelect!, years }
    }

    it('regression: switching the year drops the month of the previous year', async () => {
      mockGetConfig.mockResolvedValue({ retention_months: 14 })
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()
      const { yearSelect, years } = await selectYearAndMonth(wrapper)
      expect(mockGetSentEmails.mock.calls.at(-1)?.[0]).toHaveProperty('month')

      await yearSelect.vm.$emit('update:modelValue', years[1]!.value)
      await flushPromises()

      const call = mockGetSentEmails.mock.calls.at(-1)?.[0]
      expect(call).toEqual({ page: 1, page_size: 25, year: years[1]!.value })
      expect(wrapper.findAllComponents({ name: 'Select' })[1]!.props('modelValue')).toBeNull()
    })

    it('sends one request when the year change also drops the month', async () => {
      mockGetConfig.mockResolvedValue({ retention_months: 14 })
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()
      const { yearSelect, years } = await selectYearAndMonth(wrapper)
      mockGetSentEmails.mockClear()

      await yearSelect.vm.$emit('update:modelValue', years[1]!.value)
      await flushPromises()

      expect(mockGetSentEmails).toHaveBeenCalledTimes(1)
    })

    it('regression: the year can be cleared again', async () => {
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()
      const yearSelect = wrapper.findComponent({ name: 'Select' })
      expect(yearSelect.props('showClear')).toBe(true)
      const year = (yearSelect.props('options') as { value: number }[])[0]!.value
      await yearSelect.vm.$emit('update:modelValue', year)
      await flushPromises()

      await yearSelect.vm.$emit('update:modelValue', null)
      await flushPromises()

      expect(mockGetSentEmails).toHaveBeenLastCalledWith({ page: 1, page_size: 25 })
    })
  })

  describe('search', () => {
    it('regression: a burst of keystrokes sends one request', async () => {
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()
      mockGetSentEmails.mockClear()
      const input = wrapper.find('input.filter-search')

      await input.setValue('R')
      await input.setValue('Re')
      await input.setValue('Res')
      await typingPause()

      expect(mockGetSentEmails).toHaveBeenCalledTimes(1)
      expect(mockGetSentEmails).toHaveBeenCalledWith({ page: 1, page_size: 25, search: 'Res' })
    })

    it('waits for the pause before it searches', async () => {
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()
      mockGetSentEmails.mockClear()

      await wrapper.find('input.filter-search').setValue('Reset')
      await vi.advanceTimersByTimeAsync(299)

      expect(mockGetSentEmails).not.toHaveBeenCalled()
    })

    it('does not search after the view is gone', async () => {
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()
      mockGetSentEmails.mockClear()

      await wrapper.find('input.filter-search').setValue('Reset')
      wrapper.unmount()
      await typingPause()

      expect(mockGetSentEmails).not.toHaveBeenCalled()
    })

    it('regression: a slow answer for an earlier term does not replace the newer rows', async () => {
      const slow = deferredAnswer<ReturnType<typeof listAnswer>>()
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()
      mockGetSentEmails
        .mockReturnValueOnce(slow.promise)
        .mockResolvedValueOnce(listAnswer([buildItem({ subject: 'Newer subject' })]))
      const input = wrapper.find('input.filter-search')

      await input.setValue('old')
      await typingPause()
      await input.setValue('new')
      await typingPause()
      slow.resolve(listAnswer([buildItem({ subject: 'Stale subject' })]))
      await flushPromises()

      expect(wrapper.text()).toContain('Newer subject')
      expect(wrapper.text()).not.toContain('Stale subject')
    })

    it('regression: a late failure of an earlier term neither toasts nor ends the loading state', async () => {
      const slow = deferredAnswer<ReturnType<typeof listAnswer>>()
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()
      mockGetSentEmails.mockReturnValueOnce(slow.promise).mockReturnValueOnce(new Promise(() => {}))
      const input = wrapper.find('input.filter-search')

      await input.setValue('old')
      await typingPause()
      await input.setValue('new')
      await typingPause()
      slow.reject(new Error('timeout'))
      await flushPromises()

      expect(wrapper.findComponent({ name: 'DataTable' }).props('loading')).toBe(true)
      expect(mockToastAdd).not.toHaveBeenCalled()
    })
  })

  describe('detail', () => {
    it('regression: a late failure of the detail of an earlier row raises no toast', async () => {
      mockGetSentEmails.mockResolvedValue(
        listAnswer([buildItem({ id: EMAIL_ID_A }), buildItem({ id: EMAIL_ID_B })]),
      )
      const slow = deferredAnswer<SentEmailDetail>()
      mockGetSentEmailDetail
        .mockReturnValueOnce(slow.promise)
        .mockResolvedValueOnce(buildDetail({ id: EMAIL_ID_B, subject: 'Newer detail' }))
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()
      const buttons = wrapper.findAll('button[aria-label="Details anzeigen"]')

      await buttons[0]!.trigger('click')
      await buttons[1]!.trigger('click')
      await flushPromises()
      slow.reject(new Error('timeout'))
      await flushPromises()

      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('regression: the detail can be opened with the button of the row', async () => {
      mockGetSentEmailDetail.mockResolvedValue(buildDetail())
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()

      await wrapper.find('button[aria-label="Details anzeigen"]').trigger('click')
      await flushPromises()

      expect(mockGetSentEmailDetail).toHaveBeenCalledOnce()
      expect(mockGetSentEmailDetail).toHaveBeenCalledWith(EMAIL_ID_A)
      expect(document.body.textContent).toContain('Detail Test')
    })

    it('shows the mail body in a frame without any sandbox permission', async () => {
      mockGetSentEmailDetail.mockResolvedValue(buildDetail({ body: '<p>Hello</p>' }))
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()

      await wrapper.find('button[aria-label="Details anzeigen"]').trigger('click')
      await flushPromises()

      const frame = document.body.querySelector('iframe')
      expect(frame?.getAttribute('srcdoc')).toBe('<p>Hello</p>')
      // An empty sandbox attribute is the security control: no scripts, forms or
      // same-origin access for the stored HTML of a sent mail.
      expect(frame?.getAttribute('sandbox')).toBe('')
    })

    it('regression: a slow detail for an earlier row does not replace the newer one', async () => {
      mockGetSentEmails.mockResolvedValue(
        listAnswer([buildItem({ id: EMAIL_ID_A }), buildItem({ id: EMAIL_ID_B })]),
      )
      const slow = deferredAnswer<SentEmailDetail>()
      mockGetSentEmailDetail
        .mockReturnValueOnce(slow.promise)
        .mockResolvedValueOnce(buildDetail({ id: EMAIL_ID_B, subject: 'Newer detail' }))
      const wrapper = mount(SentEmailsView, mountOpts)
      await flushPromises()
      const buttons = wrapper.findAll('button[aria-label="Details anzeigen"]')

      await buttons[0]!.trigger('click')
      await buttons[1]!.trigger('click')
      await flushPromises()
      slow.resolve(buildDetail({ id: EMAIL_ID_A, subject: 'Stale detail' }))
      await flushPromises()

      expect(document.body.textContent).toContain('Newer detail')
      expect(document.body.textContent).not.toContain('Stale detail')
    })
  })
})
