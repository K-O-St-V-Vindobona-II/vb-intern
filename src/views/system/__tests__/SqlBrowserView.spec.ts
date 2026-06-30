import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SqlBrowserView from '../SqlBrowserView.vue'
import PrimeVue from 'primevue/config'

const mockGetTables = vi.fn()
const mockGetTableData = vi.fn()
vi.mock('@/services/systemService', () => ({
  default: {
    getTables: (...args: unknown[]) => mockGetTables(...args),
    getTableData: (...args: unknown[]) => mockGetTableData(...args),
  },
}))

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

function buildTableData() {
  return {
    table_name: 'members',
    columns: [
      { name: 'id', type: 'integer', nullable: false, primary_key: true },
      { name: 'cn', type: 'varchar', nullable: true, primary_key: false },
    ],
    rows: [{ id: '1', cn: 'Max Mustermann' }],
    total: 42,
    page: 1,
    page_size: 25,
  }
}

async function mountView() {
  const wrapper = mount(SqlBrowserView, { global: { plugins: [PrimeVue] } })
  await flushPromises()
  return wrapper
}

async function selectTable(wrapper: Awaited<ReturnType<typeof mountView>>, name: string) {
  await wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', name)
  await flushPromises()
}

describe('SqlBrowserView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTables.mockResolvedValue({ data: ['members', 'contacts'] })
    mockGetTableData.mockResolvedValue({ data: buildTableData() })
  })

  it('fetches the table list on mount and offers it as Select options', async () => {
    const wrapper = await mountView()
    expect(mockGetTables).toHaveBeenCalledOnce()
    expect(wrapper.findComponent({ name: 'Select' }).props('options')).toEqual([
      'members',
      'contacts',
    ])
  })

  it('does not show structure/data tables before a table is selected', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('.data-table').exists()).toBe(false)
    expect(wrapper.find('.row-count').exists()).toBe(false)
  })

  it('loads and shows table data, columns and the row count when a table is selected', async () => {
    const wrapper = await mountView()
    await selectTable(wrapper, 'members')

    expect(mockGetTableData).toHaveBeenCalledWith('members', { page: 1, page_size: 25 })
    expect(wrapper.find('.row-count').text()).toContain('42')
    expect(wrapper.find('.data-table').exists()).toBe(true)
    expect(wrapper.text()).toContain('Max Mustermann')
  })

  it('shows a PK tag and nullable indicator in the structure table', async () => {
    const wrapper = await mountView()
    await selectTable(wrapper, 'members')

    expect(wrapper.findComponent({ name: 'Tag' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('Ja')
    expect(wrapper.text()).toContain('Nein')
  })

  it('resets to page 1 and refetches when switching tables', async () => {
    const wrapper = await mountView()
    await selectTable(wrapper, 'members')

    const dataTable = wrapper.findComponent('.data-table')
    await dataTable.vm.$emit('page', { page: 2 })
    await flushPromises()
    expect(mockGetTableData).toHaveBeenLastCalledWith('members', { page: 3, page_size: 25 })

    mockGetTableData.mockClear()
    await selectTable(wrapper, 'contacts')

    expect(mockGetTableData).toHaveBeenCalledWith('contacts', { page: 1, page_size: 25 })
  })

  it('advances the page and refetches on the page event', async () => {
    const wrapper = await mountView()
    await selectTable(wrapper, 'members')
    mockGetTableData.mockClear()

    const dataTable = wrapper.findComponent('.data-table')
    await dataTable.vm.$emit('page', { page: 1 })
    await flushPromises()

    expect(mockGetTableData).toHaveBeenCalledWith('members', { page: 2, page_size: 25 })
  })

  it('shows an error toast when fetching the table list fails', async () => {
    mockGetTables.mockRejectedValue({ response: { data: { detail: 'Tabellen nicht verfügbar' } } })
    await mountView()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Tabellen nicht verfügbar' }),
    )
  })

  it('shows an error toast when fetching table data fails', async () => {
    mockGetTableData.mockRejectedValue({ response: { data: { detail: 'Zugriff verweigert' } } })
    const wrapper = await mountView()
    await selectTable(wrapper, 'members')

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Zugriff verweigert' }),
    )
  })
})
