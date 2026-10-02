import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import TextsAdminView from '../TextsAdminView.vue'

const baseTabs = [
  { slot: 'anfang', title: 'Der Anfang', body: 'Text zum Anfang.' },
  { slot: 'mkv', title: 'MKV', body: 'Text zum MKV.' },
  { slot: 'heute', title: 'Heute', body: 'Text zu Heute.' },
]

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockListTabs = vi.fn()
const mockUpdateTab = vi.fn()

vi.mock('@/services/publicContentService', () => ({
  aboutTabsService: {
    listTabs: (...args: unknown[]) => mockListTabs(...args),
    updateTab: (...args: unknown[]) => mockUpdateTab(...args),
  },
}))

describe('TextsAdminView', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    mockToastAdd.mockReset()
    mockListTabs.mockReset().mockResolvedValue({ data: structuredClone(baseTabs) })
    mockUpdateTab
      .mockReset()
      .mockImplementation((slot, data) => Promise.resolve({ data: { slot, ...data } }))
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const mountView = async () => {
    wrapper = mount(TextsAdminView, {
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('renders all 3 fixed tabs with their title and body', async () => {
    const w = await mountView()
    expect(w.text()).toContain('www-Administration')
    expect(w.text()).toContain('Texte')

    const titleInputs = w.findAll('input')
    expect(titleInputs.map((i) => (i.element as HTMLInputElement).value)).toEqual([
      'Der Anfang',
      'MKV',
      'Heute',
    ])
  })

  it('saves an edited tab', async () => {
    const w = await mountView()
    const titleInputs = w.findAll('input')
    await titleInputs[0]?.setValue('Neuer Titel')

    const saveButtons = w.findAll('button').filter((b) => b.text() === 'Speichern')
    await saveButtons[0]?.trigger('click')
    await flushPromises()

    expect(mockUpdateTab).toHaveBeenCalledWith('anfang', {
      title: 'Neuer Titel',
      body: 'Text zum Anfang.',
    })
  })

  it('saves tabs independently of each other', async () => {
    const w = await mountView()
    const saveButtons = w.findAll('button').filter((b) => b.text() === 'Speichern')
    await saveButtons[1]?.trigger('click')
    await flushPromises()

    expect(mockUpdateTab).toHaveBeenCalledOnce()
    expect(mockUpdateTab).toHaveBeenCalledWith('mkv', {
      title: 'MKV',
      body: 'Text zum MKV.',
    })
  })

  const saveButtons = (w: VueWrapper) => w.findAll('button').filter((b) => b.text() === 'Speichern')

  it('shows a toast and a retry button instead of empty forms when loading fails', async () => {
    mockListTabs.mockRejectedValueOnce({ response: { data: { detail: 'Serverfehler' } } })
    const w = await mountView()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Serverfehler' }),
    )
    expect(w.findAll('input')).toHaveLength(0)

    await w
      .findAll('button')
      .find((b) => b.text().includes('Erneut versuchen'))
      ?.trigger('click')
    await flushPromises()

    expect(w.findAll('input')).toHaveLength(3)
  })

  it('regression: saves title and text without surrounding blanks', async () => {
    const w = await mountView()
    await w.findAll('input')[0]?.setValue('  Neuer Titel  ')
    await w.findAll('textarea')[0]?.setValue('\n  Neuer Text.  \n')

    await saveButtons(w)[0]?.trigger('click')
    await flushPromises()

    expect(mockUpdateTab).toHaveBeenCalledWith('anfang', {
      title: 'Neuer Titel',
      body: 'Neuer Text.',
    })
  })

  it('regression: a blank title or text cannot be saved', async () => {
    const w = await mountView()

    await w.findAll('input')[0]?.setValue('   ')
    expect(saveButtons(w)[0]?.attributes('disabled')).toBeDefined()
    expect(saveButtons(w)[1]?.attributes('disabled')).toBeUndefined()

    await w.findAll('input')[0]?.setValue('Titel')
    await w.findAll('textarea')[0]?.setValue('  ')
    expect(saveButtons(w)[0]?.attributes('disabled')).toBeDefined()
  })

  it('regression: a text beyond the limit of the API cannot be saved and shows its length', async () => {
    const w = await mountView()
    await w.findAll('textarea')[0]?.setValue('x'.repeat(6001))

    expect(saveButtons(w)[0]?.attributes('disabled')).toBeDefined()
    expect(w.find('.body-counter-over').text()).toBe('6001 / 6000')

    await w.findAll('textarea')[0]?.setValue('x'.repeat(6000))
    expect(saveButtons(w)[0]?.attributes('disabled')).toBeUndefined()
  })

  it('shows the saved title in the success toast and replaces the form with the answer', async () => {
    mockUpdateTab.mockResolvedValue({ data: { slot: 'anfang', title: 'Vom Server', body: 'B' } })
    const w = await mountView()

    await saveButtons(w)[0]?.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', detail: '"Vom Server" wurde gespeichert.' }),
    )
    expect((w.findAll('input')[0]?.element as HTMLInputElement).value).toBe('Vom Server')
  })

  it('keeps the edits and shows a toast when saving fails', async () => {
    mockUpdateTab.mockRejectedValue({
      response: { data: { detail: 'Link muss mit http:// oder https:// beginnen.' } },
    })
    const w = await mountView()
    await w.findAll('input')[0]?.setValue('Neuer Titel')

    await saveButtons(w)[0]?.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Link muss mit http:// oder https:// beginnen.',
      }),
    )
    expect((w.findAll('input')[0]?.element as HTMLInputElement).value).toBe('Neuer Titel')
  })

  describe('counter and load failure text', () => {
    it('shows the length counter of every text and marks only a text beyond the limit', async () => {
      const w = await mountView()

      const counters = w.findAll('.body-counter')
      expect(counters.map((c) => c.text())).toEqual([
        `${baseTabs[0]!.body.length} / 6000`,
        `${baseTabs[1]!.body.length} / 6000`,
        `${baseTabs[2]!.body.length} / 6000`,
      ])
      expect(w.find('.body-counter-over').exists()).toBe(false)

      await w.findAll('textarea')[1]?.setValue('x'.repeat(6001))

      expect(w.findAll('.body-counter-over')).toHaveLength(1)
    })

    it('says what could not be loaded', async () => {
      mockListTabs.mockRejectedValueOnce(new Error('offline'))
      const w = await mountView()

      expect(w.text()).toContain('Texte konnten nicht geladen werden.')
    })
  })
})
