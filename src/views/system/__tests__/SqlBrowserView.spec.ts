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

    const dataTable = wrapper.findAllComponents({ name: 'DataTable' }).at(-1)!
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

    const dataTable = wrapper.findAllComponents({ name: 'DataTable' }).at(-1)!
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

  function deferredData() {
    let resolvePromise!: (value: unknown) => void
    const promise = new Promise((resolve) => {
      resolvePromise = resolve
    })
    return { promise, resolve: resolvePromise }
  }

  function tableData(name: string, cn: string, total: number) {
    return {
      data: {
        ...buildTableData(),
        table_name: name,
        rows: [{ id: '1', cn }],
        total,
      },
    }
  }

  it('regression: a slow answer for the previously selected table does not replace the current table', async () => {
    const slow = deferredData()
    mockGetTableData
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(tableData('contacts', 'Kontakt Beispiel', 7))
    const wrapper = await mountView()

    await selectTable(wrapper, 'members')
    await selectTable(wrapper, 'contacts')
    expect(wrapper.text()).toContain('Kontakt Beispiel')

    slow.resolve(tableData('members', 'Max Mustermann', 42))
    await flushPromises()

    expect(wrapper.text()).toContain('Kontakt Beispiel')
    expect(wrapper.text()).not.toContain('Max Mustermann')
    expect(wrapper.find('.row-count').text()).toContain('7')
  })

  it('regression: a late failure for the previous table raises no error toast and keeps the loading state of the current one', async () => {
    let rejectSlow!: (reason: unknown) => void
    const slow = new Promise((_resolve, reject) => {
      rejectSlow = reject
    })
    const current = deferredData()
    mockGetTableData.mockReturnValueOnce(slow).mockReturnValueOnce(current.promise)
    const wrapper = await mountView()

    await selectTable(wrapper, 'members')
    await selectTable(wrapper, 'contacts')
    rejectSlow({ response: { data: { detail: 'Zeitüberschreitung' } } })
    await flushPromises()

    expect(mockToastAdd).not.toHaveBeenCalled()
    current.resolve(tableData('contacts', 'Kontakt Beispiel', 7))
    await flushPromises()
    expect(wrapper.text()).toContain('Kontakt Beispiel')
  })

  it('regression: a slow answer for an earlier page does not replace the rows or the loading state of the newer page', async () => {
    const wrapper = await mountView()
    await selectTable(wrapper, 'members')
    const earlier = deferredData()
    const newer = deferredData()
    mockGetTableData.mockReturnValueOnce(earlier.promise).mockReturnValueOnce(newer.promise)
    const table = wrapper.findAllComponents({ name: 'DataTable' }).at(-1)!

    await table.vm.$emit('page', { page: 1 })
    await table.vm.$emit('page', { page: 2 })
    earlier.resolve(tableData('members', 'Seite zwei', 100))
    await flushPromises()

    expect(wrapper.text()).not.toContain('Seite zwei')
    expect(table.props('loading')).toBe(true)

    newer.resolve(tableData('members', 'Seite drei', 100))
    await flushPromises()

    expect(wrapper.text()).toContain('Seite drei')
    expect(table.props('loading')).toBe(false)
  })

  it('regression: clearing the selection invalidates a request that is still running', async () => {
    const slow = deferredData()
    mockGetTableData.mockReturnValueOnce(slow.promise)
    const wrapper = await mountView()
    await selectTable(wrapper, 'members')

    await wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', null)
    await flushPromises()
    slow.resolve(tableData('members', 'Max Mustermann', 42))
    await flushPromises()

    expect(wrapper.text()).not.toContain('Max Mustermann')
    expect(wrapper.find('.data-table').exists()).toBe(false)
  })

  it('shows page 1 again in the paginator when another table is selected', async () => {
    mockGetTableData.mockResolvedValue(tableData('members', 'Max Mustermann', 100))
    const wrapper = await mountView()
    await selectTable(wrapper, 'members')

    const thirdPage = wrapper.findAll('.p-paginator-page')[2]!
    await thirdPage.trigger('click')
    await flushPromises()
    expect(wrapper.find('.p-paginator-page-selected').text()).toBe('3')

    await selectTable(wrapper, 'contacts')

    expect(wrapper.find('.p-paginator-page-selected').text()).toBe('1')
  })

  it('offers the full cell value as a tooltip, since long values are cut off on screen', async () => {
    const long = 'x'.repeat(200)
    mockGetTableData.mockResolvedValue(tableData('members', long, 1))
    const wrapper = await mountView()
    await selectTable(wrapper, 'members')

    expect(wrapper.find('.cell-value:not(:empty)').attributes('title')).toBeTruthy()
    expect(wrapper.findAll('.cell-value').some((c) => c.attributes('title') === long)).toBe(true)
  })
})
