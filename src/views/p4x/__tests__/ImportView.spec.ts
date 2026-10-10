import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ImportView from '../ImportView.vue'
import PrimeVue from 'primevue/config'
import type { P4xAccount, ImportResult } from '@/types/p4x'

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ params: { accountId: '3' } })),
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockGetDashboard = vi.fn()
const mockImportTransactions = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
    importTransactions: (...args: unknown[]) => mockImportTransactions(...args),
  },
}))

function buildAccount(overrides: Partial<P4xAccount> = {}): P4xAccount {
  return {
    id: '3',
    iban: 'AT001234',
    bic: 'GIBAATWWXXX',
    label: 'Kasse Wien',
    init_date: '2020-01-01',
    init_balance: 0,
    balance: 100,
    transactions_count: 5,
    transactions_latest: '2026-06-01',
    ...overrides,
  }
}

function buildImportResult(overrides: Partial<ImportResult> = {}): ImportResult {
  return {
    given: { p4x_account_id: '3', parsed: true },
    summary: { giventotal: 10, existing: 4, new: 6 },
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

function buildFile(): File {
  return new File(['{}'], 'export.json', { type: 'application/json' })
}

describe('ImportView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDashboard.mockResolvedValue({ data: { accounts: [buildAccount()] } })
  })

  it('loads and shows the matching account on mount', async () => {
    const wrapper = mount(ImportView, mountOpts)
    await flushPromises()

    expect(mockGetDashboard).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Kasse Wien')
    wrapper.unmount()
  })

  it('disables the import button until a file is selected', async () => {
    const wrapper = mount(ImportView, mountOpts)
    await flushPromises()

    const button = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Transaktionen importieren'),
    )!
    expect(button.hasAttribute('disabled')).toBe(true)
    wrapper.unmount()
  })

  it('shows the selected file name once a file is chosen', async () => {
    const wrapper = mount(ImportView, mountOpts)
    await flushPromises()

    const input = wrapper.find('input[type="file"]')
    const file = buildFile()
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')

    expect(wrapper.find('.file-name').text()).toBe('export.json')
    wrapper.unmount()
  })

  it('imports the file, reloads the account and shows a success toast on a parsed result', async () => {
    mockImportTransactions.mockResolvedValue({ data: buildImportResult() })
    const wrapper = mount(ImportView, mountOpts)
    await flushPromises()

    const input = wrapper.find('input[type="file"]')
    const file = buildFile()
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')

    const button = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Transaktionen importieren'),
    )!
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockImportTransactions).toHaveBeenCalledWith('3', file)
    expect(mockGetDashboard).toHaveBeenCalledTimes(2)
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Import abgeschlossen' }),
    )
    const rows = wrapper.findAll('.summary-row').map((row) => row.text().replace(/\s+/g, ' '))
    expect(rows).toEqual([
      'Insgesamt hochgeladene Transaktionen:10',
      'Bereits existierende Transaktionen:4',
      'Neuimportierte Transaktionen:6',
    ])
    wrapper.unmount()
  })

  it('locks the file field while an import is running', async () => {
    mockImportTransactions.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(ImportView, mountOpts)
    await flushPromises()
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [buildFile()] })
    await input.trigger('change')
    expect((input.element as HTMLInputElement).disabled).toBe(false)

    Array.from(document.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Transaktionen importieren'))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect((input.element as HTMLInputElement).disabled).toBe(true)
    wrapper.unmount()
  })

  it('shows an error toast and the parse-error card when parsing fails', async () => {
    mockImportTransactions.mockResolvedValue({
      data: {
        given: { p4x_account_id: '3', parsed: false },
        summary: {},
        message: 'Ungültiges Format',
      },
    })
    const wrapper = mount(ImportView, mountOpts)
    await flushPromises()

    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [buildFile()] })
    await input.trigger('change')

    const button = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Transaktionen importieren'),
    )!
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockGetDashboard).toHaveBeenCalledOnce()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Ungültiges Format' }),
    )
    expect(wrapper.find('.error-msg').text()).toBe('Ungültiges Format')
    wrapper.unmount()
  })

  it('shows an error toast and resets the file input when the upload itself fails', async () => {
    mockImportTransactions.mockRejectedValue({ response: { data: { detail: 'Serverfehler' } } })
    const wrapper = mount(ImportView, mountOpts)
    await flushPromises()

    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [buildFile()] })
    await input.trigger('change')

    const button = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Transaktionen importieren'),
    )!
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    expect(wrapper.find('.picker-label').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows a retry state instead of a silently empty page when loading the account fails, and recovers on retry', async () => {
    mockGetDashboard.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(ImportView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('Die Daten konnten nicht geladen werden.')
    expect(wrapper.find('.account-card').exists()).toBe(false)
    const retryBtn = wrapper.findAll('button').find((b) => b.text() === 'Erneut versuchen')
    expect(retryBtn).toBeDefined()

    mockGetDashboard.mockResolvedValueOnce({ data: { accounts: [buildAccount()] } })
    await retryBtn!.trigger('click')
    await flushPromises()

    expect(mockGetDashboard).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('konnten nicht geladen werden')
    expect(wrapper.find('.account-card').exists()).toBe(true)
    wrapper.unmount()
  })

  it('associates the file picker label with the file input for keyboard/screen-reader access (regression)', async () => {
    const wrapper = mount(ImportView, mountOpts)
    await flushPromises()

    const input = wrapper.find('input[type="file"]')
    const label = wrapper.find('label.file-picker')
    expect(label.exists()).toBe(true)
    expect(label.attributes('for')).toBe(input.attributes('id'))
    wrapper.unmount()
  })

  it('reports a successful import as such when only the reload of the account fails', async () => {
    mockImportTransactions.mockResolvedValue({ data: buildImportResult() })
    const wrapper = mount(ImportView, mountOpts)
    await flushPromises()
    mockGetDashboard.mockRejectedValueOnce(new Error('boom'))

    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [buildFile()] })
    await input.trigger('change')
    const button = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Transaktionen importieren'),
    )!
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Import abgeschlossen' }),
    )
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn', summary: 'Konto nicht aktualisiert' }),
    )
    expect(mockToastAdd).not.toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    expect(wrapper.find('.result-card').exists()).toBe(true)
    wrapper.unmount()
  })
})
