import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import FeeMemberView from '../FeeMemberView.vue'
import FeeMemberCriteriaInfoBox from '../components/FeeMemberCriteriaInfoBox.vue'
import PrimeVue from 'primevue/config'
import type { FeeMember } from '@/types/p4x'

const mockRoute: { params: Record<string, string> } = { params: {} }
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockSearchFeeMembers = vi.fn()
const mockGetFeeMember = vi.fn()
const mockExportFeeMember = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    searchFeeMembers: (...args: unknown[]) => mockSearchFeeMembers(...args),
    getFeeMember: (...args: unknown[]) => mockGetFeeMember(...args),
    exportFeeMember: (...args: unknown[]) => mockExportFeeMember(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
const mockRevokeObjectURL = vi.fn()
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

beforeAll(() => {
  URL.createObjectURL = mockCreateObjectURL
  URL.revokeObjectURL = mockRevokeObjectURL
})

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
})

function buildMember(overrides: Partial<FeeMember> = {}): FeeMember {
  return {
    id: '1',
    cn: 'Max Mustermann',
    p4x_init_date: '2020-01-01',
    p4x_init_balance: 10,
    p4x_freed: false,
    p4x_comment: null,
    balance: {
      start_date: '2020-01-01',
      start_balance: 10,
      count: { fees: 4, payments: 3 },
      sum: { fees: 40, payments: -30 },
      end_date: '2026-06-01',
      end_balance: 20,
      progress: [
        { type: 'fee', booking: '2026-01-01', amount: 10, balance: 20 },
        { type: 'payment', booking: '2026-02-01', amount: -10, balance: 10 },
      ],
    },
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

function findButtonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find((b) => b.text().includes(text))
  if (!button) throw new Error(`No button with text "${text}" found`)
  return button
}

describe('FeeMemberView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.params = {}
  })

  it('does not show member details before a member is loaded', async () => {
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(mockGetFeeMember).not.toHaveBeenCalled()
    expect(wrapper.find('.member-detail').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the shared FeeMemberCriteriaInfoBox below the search field', async () => {
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.findComponent(FeeMemberCriteriaInfoBox).exists()).toBe(true)
    wrapper.unmount()
  })

  it('loads the member from the route id on mount', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(mockGetFeeMember).toHaveBeenCalledWith('1')
    expect(wrapper.find('.member-name').text()).toBe('Max Mustermann')
    wrapper.unmount()
  })

  it('shows an error toast instead of silently doing nothing when loading from the route id fails', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockRejectedValue(new Error('boom'))
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Beitragskonto konnte nicht geladen werden.',
      }),
    )
    expect(wrapper.find('.member-detail').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows balance counts and sums when a balance is present', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.text()).toContain('4 verrechnete Beiträge')
    expect(wrapper.text()).toContain('3 geleistete Zahlungen')
    expect(wrapper.find('.balance-total').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not show fee/payment rows when the member has no balance yet', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember({ balance: null }) })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.balance-total').exists()).toBe(false)
    expect(wrapper.find('.progress-section').exists()).toBe(false)
    wrapper.unmount()
  })

  it('loads a member when selected via the search field', async () => {
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()
    mockGetFeeMember.mockResolvedValue({ data: buildMember({ id: '5', cn: 'Erika Beispiel' }) })

    const search = wrapper.findComponent({ name: 'SearchField' })
    await search.vm.$emit('select', { id: '5', label: 'Erika Beispiel', type: 'member' })
    await flushPromises()

    expect(mockGetFeeMember).toHaveBeenCalledWith('5')
    expect(wrapper.find('.member-name').text()).toBe('Erika Beispiel')
    wrapper.unmount()
  })

  it('shows an error toast and keeps the previous member when loading a selected member fails', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValueOnce({ data: buildMember() })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()
    mockGetFeeMember.mockRejectedValueOnce(new Error('boom'))

    const search = wrapper.findComponent({ name: 'SearchField' })
    await search.vm.$emit('select', { id: '5', label: 'Erika Beispiel', type: 'member' })
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Beitragskonto konnte nicht geladen werden.',
      }),
    )
    expect(wrapper.find('.member-name').text()).toBe('Max Mustermann')
    wrapper.unmount()
  })

  it('forwards the query to searchFeeMembers via the search-fn prop', async () => {
    mockSearchFeeMembers.mockResolvedValue({
      data: { data: [{ id: 1, label: 'Max', type: 'member' }] },
    })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    const search = wrapper.findComponent({ name: 'SearchField' })
    const found = await (search.props('searchFn') as (q: string) => Promise<unknown>)('Max')

    expect(mockSearchFeeMembers).toHaveBeenCalledWith('Max')
    expect(found).toEqual([{ id: 1, label: 'Max', type: 'member' }])
    wrapper.unmount()
  })

  it('toggles the progress list visibility', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.progress-list').exists()).toBe(false)

    await wrapper.find('.progress-toggle').trigger('click')
    expect(wrapper.find('.progress-list').exists()).toBe(true)
    expect(wrapper.findAll('.progress-entry')).toHaveLength(2)

    await wrapper.find('.progress-toggle').trigger('click')
    expect(wrapper.find('.progress-list').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the running balance in a 4-column progress table', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    await wrapper.find('.progress-toggle').trigger('click')

    const header = wrapper.find('.progress-header')
    expect(header.text()).toContain('Datum')
    expect(header.text()).toContain('Transaktionsart')
    expect(header.text()).toContain('Betrag')
    expect(header.text()).toContain('Saldo')

    const rows = wrapper.findAll('.progress-entry')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.text()).toContain('Fälligkeit')
    expect(rows[1]?.text()).toContain('Zahlung')
    wrapper.unmount()
  })

  it('exports the fee member using the filename from the content-disposition header', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    mockExportFeeMember.mockResolvedValue({
      data: new Blob(['x']),
      headers: { 'content-disposition': 'attachment; filename="Beitragskonto_Test.xlsx"' },
    })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    await findButtonByText(wrapper, 'Export Excel').trigger('click')
    await flushPromises()

    expect(mockExportFeeMember).toHaveBeenCalledWith('1')
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
    wrapper.unmount()
  })

  it('shows an error toast when the export fails', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    mockExportFeeMember.mockRejectedValue(new Error('failed'))
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    await findButtonByText(wrapper, 'Export Excel').trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    wrapper.unmount()
  })

  it('shows a hint instead of the overview when no init date is set', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember({ p4x_init_date: null }) })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.no-setup-hint').exists()).toBe(true)
    expect(wrapper.find('.balance-grid').exists()).toBe(false)
    expect(wrapper.find('.progress-section').exists()).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text().includes('Export Excel'))).toBe(false)
    wrapper.unmount()
  })

  it('shows a hint instead of the overview when no init balance is set', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember({ p4x_init_balance: null }) })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.no-setup-hint').exists()).toBe(true)
    expect(wrapper.find('.balance-grid').exists()).toBe(false)
    wrapper.unmount()
  })

  it('always shows an edit button that navigates to the edit route', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember({ p4x_init_date: null }) })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    await findButtonByText(wrapper, 'Bearbeiten').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({ name: 'p4x-fee-member-edit', params: { id: '1' } })
    wrapper.unmount()
  })

  it('shows a freed indicator between the name and the comment when freed', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({
      data: buildMember({ p4x_freed: true, p4x_comment: 'Sonderfall' }),
    })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.member-freed').text()).toBe('Vom Mitgliedsbeitrag befreit')

    const detail = wrapper.get('.member-detail')
    const freedIndex = detail.html().indexOf('member-freed')
    const commentIndex = detail.html().indexOf('member-comment')
    expect(freedIndex).toBeLessThan(commentIndex)
    wrapper.unmount()
  })

  it('shows no freed indicator when not freed', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember({ p4x_freed: false }) })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.member-freed').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows only the freed fact and comment, no summary or history, when freed', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({
      data: buildMember({ p4x_freed: true, p4x_comment: 'Sonderfall' }),
    })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.member-freed').exists()).toBe(true)
    expect(wrapper.find('.member-comment').exists()).toBe(true)
    expect(wrapper.find('.balance-grid').exists()).toBe(false)
    expect(wrapper.find('.no-setup-hint').exists()).toBe(false)
    expect(wrapper.find('.progress-section').exists()).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text().includes('Export Excel'))).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text().includes('Bearbeiten'))).toBe(true)
    wrapper.unmount()
  })

  it('shows the comment between the name and the summary when set', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember({ p4x_comment: 'Sonderfall' }) })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.member-comment').text()).toBe('Sonderfall')
    wrapper.unmount()
  })

  it('shows no comment element when no comment is set', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember({ p4x_comment: null }) })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    expect(wrapper.find('.member-comment').exists()).toBe(false)
    wrapper.unmount()
  })

  it('places the button row before the transaction history', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    const detail = wrapper.get('.member-detail')
    const actionsIndex = detail.html().indexOf('member-actions')
    const progressIndex = detail.html().indexOf('progress-section')

    expect(actionsIndex).toBeGreaterThan(-1)
    expect(progressIndex).toBeGreaterThan(-1)
    expect(actionsIndex).toBeLessThan(progressIndex)
    wrapper.unmount()
  })

  describe('export download', () => {
    let downloads: string[]

    beforeEach(() => {
      downloads = []
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloads.push(this.download)
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('saves the file under the name from the content-disposition header and reports it', async () => {
      mockRoute.params = { id: '1' }
      mockGetFeeMember.mockResolvedValue({ data: buildMember() })
      mockExportFeeMember.mockResolvedValue({
        data: new Blob(['x']),
        headers: { 'content-disposition': 'attachment; filename="Beitragskonto_Test.xlsx"' },
      })
      const wrapper = mount(FeeMemberView, mountOpts)
      await flushPromises()

      await findButtonByText(wrapper, 'Export Excel').trigger('click')
      await flushPromises()

      expect(downloads).toEqual(['Beitragskonto_Test.xlsx'])
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'Beitragskonto_Test.xlsx wurde heruntergeladen.' }),
      )
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
      wrapper.unmount()
    })

    it('falls back to a name built from the member id without a content-disposition header', async () => {
      mockRoute.params = { id: '1' }
      mockGetFeeMember.mockResolvedValue({ data: buildMember() })
      mockExportFeeMember.mockResolvedValue({ data: new Blob(['x']), headers: {} })
      const wrapper = mount(FeeMemberView, mountOpts)
      await flushPromises()

      await findButtonByText(wrapper, 'Export Excel').trigger('click')
      await flushPromises()

      expect(downloads).toEqual(['Beitragskonto_1.xlsx'])
      wrapper.unmount()
    })
  })

  it('shows the sums and the end balance of the account', async () => {
    mockRoute.params = { id: '1' }
    mockGetFeeMember.mockResolvedValue({ data: buildMember() })
    const wrapper = mount(FeeMemberView, mountOpts)
    await flushPromises()

    const rowTexts = wrapper.findAll('.balance-row').map((row) => row.text().replace(/\s+/g, ' '))
    expect(rowTexts.find((t) => t.startsWith('4 verrechnete Beiträge'))).toContain('40,00')
    expect(rowTexts.find((t) => t.startsWith('3 geleistete Zahlungen'))).toContain('30,00')
    expect(rowTexts.find((t) => t.startsWith('Endstand'))).toContain('20,00')
    wrapper.unmount()
  })
})
