import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import QuotesAdminView from '../QuotesAdminView.vue'

const FIRST_QUOTE_ID = '0199a1c2-0000-7000-8000-000000000001'
const SECOND_QUOTE_ID = '0199a1c2-0000-7000-8000-000000000002'
const THIRD_QUOTE_ID = '0199a1c2-0000-7000-8000-000000000003'

const baseQuotes = [
  { id: FIRST_QUOTE_ID, quote: 'Erstes Zitat.', author: 'Autor Eins' },
  { id: SECOND_QUOTE_ID, quote: 'Zweites Zitat.', author: 'Autor Zwei' },
]

const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({ add: mockToastAdd })),
}))

const mockList = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockMove = vi.fn()
const mockRemove = vi.fn()

vi.mock('@/services/publicContentService', () => ({
  quotesService: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    move: (...args: unknown[]) => mockMove(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
}))

describe('QuotesAdminView', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    mockToastAdd.mockReset()
    mockList.mockReset().mockResolvedValue({ data: structuredClone(baseQuotes) })
    mockCreate
      .mockReset()
      .mockResolvedValue({ data: { id: THIRD_QUOTE_ID, quote: 'Neu', author: 'X' } })
    mockUpdate.mockReset().mockResolvedValue({ data: baseQuotes[0] })
    mockMove.mockReset().mockResolvedValue({ data: { status: 'ok' } })
    mockRemove.mockReset().mockResolvedValue({ data: undefined })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const mountView = async () => {
    wrapper = mount(QuotesAdminView, {
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('renders the seeded quotes', async () => {
    const w = await mountView()
    expect(w.text()).toContain('Zitate')
    expect(w.text()).toContain('Erstes Zitat.')
    expect(w.text()).toContain('Autor Eins')
  })

  it('shows an empty state when there are no quotes', async () => {
    mockList.mockResolvedValue({ data: [] })
    const w = await mountView()
    expect(w.text()).toContain('Keine Zitate vorhanden.')
  })

  it('adds a new quote', async () => {
    const w = await mountView()
    const quoteInput = w
      .findAll('input')
      .find((i) => (i.element as HTMLInputElement).placeholder === 'Zitat')
    const authorInput = w
      .findAll('input')
      .find((i) => (i.element as HTMLInputElement).placeholder === 'Urheber')
    await quoteInput?.setValue('Ein neues Zitat')
    await authorInput?.setValue('Jemand')

    const addButton = w.findAll('button').find((b) => b.text() === 'Hinzufügen')
    await addButton?.trigger('click')
    await flushPromises()

    expect(mockCreate).toHaveBeenCalledWith({ quote: 'Ein neues Zitat', author: 'Jemand' })
  })

  it('disables add until both fields are filled', async () => {
    const w = await mountView()
    const addButton = w.findAll('button').find((b) => b.text() === 'Hinzufügen')
    expect(addButton?.attributes('disabled')).toBeDefined()
  })

  it('moves a quote down', async () => {
    const w = await mountView()
    const downButtons = w.findAll('button[aria-label^="Nach unten verschieben"]')
    await downButtons[0]?.trigger('click')
    await flushPromises()

    expect(mockMove).toHaveBeenCalledWith(FIRST_QUOTE_ID, 'down')
  })

  it('saves an edited quote', async () => {
    const w = await mountView()
    const editButtons = w.findAll('button').filter((b) => b.text().includes('Bearbeiten'))
    await editButtons[0]?.trigger('click')
    await flushPromises()

    const quoteInput = document.querySelector<HTMLInputElement>('#edit-quote-text')
    quoteInput!.value = 'Geändertes Zitat'
    quoteInput!.dispatchEvent(new Event('input'))

    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )
    saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockUpdate).toHaveBeenCalledWith(FIRST_QUOTE_ID, {
      quote: 'Geändertes Zitat',
      author: 'Autor Eins',
    })
  })

  it('deletes a quote after confirming', async () => {
    const w = await mountView()
    const deleteButtons = w.findAll('button').filter((b) => b.text().includes('Löschen'))
    await deleteButtons[0]?.trigger('click')
    await flushPromises()

    const confirmButton = Array.from(document.querySelectorAll('.p-dialog button')).find(
      (b) => b.textContent === 'Löschen',
    )
    confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockRemove).toHaveBeenCalledWith(FIRST_QUOTE_ID)
  })

  const clickDialogButton = async (label: string) => {
    Array.from(document.querySelectorAll('.p-dialog button'))
      .find((b) => b.textContent === label)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
  }

  const quoteInput = (w: VueWrapper) => w.find('input[placeholder="Zitat"]')
  const authorInput = (w: VueWrapper) => w.find('input[placeholder="Urheber"]')
  const addButton = (w: VueWrapper) => w.findAll('button').find((b) => b.text() === 'Hinzufügen')

  it('shows a toast and a retry button instead of an empty list when loading fails', async () => {
    mockList.mockRejectedValueOnce({ response: { data: { detail: 'Serverfehler' } } })
    const w = await mountView()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Serverfehler' }),
    )
    expect(w.text()).toContain('Zitate konnten nicht geladen werden.')
    expect(w.text()).not.toContain('Keine Zitate vorhanden.')

    await w
      .findAll('button')
      .find((b) => b.text().includes('Erneut versuchen'))
      ?.trigger('click')
    await flushPromises()

    expect(w.text()).toContain('Erstes Zitat.')
  })

  it('regression: adds the quote and the author without surrounding blanks', async () => {
    const w = await mountView()
    await quoteInput(w).setValue('  Ein neues Zitat  ')
    await authorInput(w).setValue(' Jemand ')

    await addButton(w)?.trigger('click')
    await flushPromises()

    expect(mockCreate).toHaveBeenCalledWith({ quote: 'Ein neues Zitat', author: 'Jemand' })
  })

  it('does not add a quote whose text or author is only blanks', async () => {
    const w = await mountView()
    await quoteInput(w).setValue('Ein Zitat')
    await authorInput(w).setValue('   ')

    expect(addButton(w)?.attributes('disabled')).toBeDefined()
  })

  it('shows a toast and keeps the input when adding fails', async () => {
    mockCreate.mockRejectedValue({ response: { data: { detail: 'Hinzufügen kaputt' } } })
    const w = await mountView()
    await quoteInput(w).setValue('Ein Zitat')
    await authorInput(w).setValue('Jemand')

    await addButton(w)?.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Hinzufügen kaputt' }),
    )
    expect((quoteInput(w).element as HTMLInputElement).value).toBe('Ein Zitat')
  })

  it('regression: reordering does not rebuild the page', async () => {
    const w = await mountView()
    const input = quoteInput(w).element

    await w.findAll('button[aria-label^="Nach unten verschieben"]')[0]?.trigger('click')
    await flushPromises()

    expect(mockList).toHaveBeenCalledTimes(2)
    expect(quoteInput(w).element).toBe(input)
  })

  it('regression: a typed but unsent quote survives a reorder', async () => {
    const w = await mountView()
    await quoteInput(w).setValue('Halb getippt')

    await w.findAll('button[aria-label^="Nach unten verschieben"]')[0]?.trigger('click')
    await flushPromises()

    expect((quoteInput(w).element as HTMLInputElement).value).toBe('Halb getippt')
  })

  it('regression: the row buttons wait for a pending move', async () => {
    let resolveMove!: (value: unknown) => void
    mockMove.mockReturnValueOnce(new Promise((resolve) => (resolveMove = resolve)))
    const w = await mountView()

    await w.findAll('button[aria-label^="Nach unten verschieben"]')[0]?.trigger('click')

    expect(
      w.findAll('button[aria-label^="Nach "]').every((b) => b.attributes('disabled') !== undefined),
    ).toBe(true)
    resolveMove({ data: { status: 'ok' } })
    await flushPromises()
    expect(
      w.findAll('button[aria-label^="Nach unten verschieben"]')[0]?.attributes('disabled'),
    ).toBeUndefined()
  })

  it('shows a toast and keeps the list when the list cannot be read after a change', async () => {
    const w = await mountView()
    mockList.mockRejectedValueOnce({ response: { data: { detail: 'Liste kaputt' } } })

    await w.findAll('button[aria-label^="Nach unten verschieben"]')[0]?.trigger('click')
    await flushPromises()

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Liste kaputt' }),
    )
    expect(w.text()).toContain('Erstes Zitat.')
  })

  it('regression: names the row buttons and the add fields', async () => {
    const w = await mountView()

    expect(w.find('button[aria-label="Löschen: Erstes Zitat."]').exists()).toBe(true)
    expect(w.find('button[aria-label="Bearbeiten: Zweites Zitat."]').exists()).toBe(true)
    expect(w.find('input[aria-label="Neues Zitat"]').exists()).toBe(true)
    expect(w.find('input[aria-label="Urheber des neuen Zitats"]').exists()).toBe(true)
  })

  it('regression: the edit dialog sends trimmed values and cannot save a blank one', async () => {
    const w = await mountView()
    await w
      .findAll('button')
      .filter((b) => b.text().includes('Bearbeiten'))[0]
      ?.trigger('click')
    await flushPromises()
    const author = document.querySelector<HTMLInputElement>('#edit-quote-author')!
    author.value = '  Neuer Autor  '
    author.dispatchEvent(new Event('input'))
    await clickDialogButton('Speichern')
    expect(mockUpdate).toHaveBeenCalledWith(FIRST_QUOTE_ID, {
      quote: 'Erstes Zitat.',
      author: 'Neuer Autor',
    })

    await w
      .findAll('button')
      .filter((b) => b.text().includes('Bearbeiten'))[0]
      ?.trigger('click')
    await flushPromises()
    const blank = document.querySelector<HTMLInputElement>('#edit-quote-text')!
    blank.value = '  '
    blank.dispatchEvent(new Event('input'))
    await flushPromises()
    const save = Array.from(document.querySelectorAll('.p-dialog button')).find(
      (b) => b.textContent === 'Speichern',
    )
    expect(save?.hasAttribute('disabled')).toBe(true)
  })

  it('keeps the quote in the list when deleting fails', async () => {
    mockRemove.mockRejectedValue({ response: { data: { detail: 'Löschen kaputt' } } })
    const w = await mountView()
    await w
      .findAll('button')
      .filter((b) => b.text().includes('Löschen'))[0]
      ?.trigger('click')
    await flushPromises()

    await clickDialogButton('Löschen')

    expect(w.text()).toContain('Erstes Zitat.')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Löschen kaputt' }),
    )
  })

  describe('refreshed list, failures, limits and row names', () => {
    it.each([
      [
        'adding a quote',
        async (w: VueWrapper) => {
          await w.find('input[aria-label="Neues Zitat"]').setValue('Ein neues Zitat')
          await w.find('input[aria-label="Urheber des neuen Zitats"]').setValue('Jemand')
          await w
            .findAll('button')
            .find((b) => b.text() === 'Hinzufügen')
            ?.trigger('click')
        },
      ],
      [
        'moving a quote',
        async (w: VueWrapper) => {
          await w.findAll('button[aria-label^="Nach unten verschieben"]')[0]?.trigger('click')
        },
      ],
      [
        'saving an edit',
        async (w: VueWrapper) => {
          await w.findAll('button[aria-label^="Bearbeiten"]')[0]?.trigger('click')
          await flushPromises()
          await clickDialogButton('Speichern')
        },
      ],
    ])('shows the list as the API returns it after %s', async (_label, act) => {
      const w = await mountView()
      mockList.mockResolvedValue({
        data: [{ id: FIRST_QUOTE_ID, quote: 'Nachgeladenes Zitat.', author: 'Autor Neu' }],
      })

      await act(w)
      await flushPromises()

      expect(mockList).toHaveBeenCalledTimes(2)
      expect(w.text()).toContain('Nachgeladenes Zitat.')
      expect(w.text()).not.toContain('Erstes Zitat.')
    })

    it('shows the API reason when moving or saving fails and keeps the list', async () => {
      mockMove.mockRejectedValueOnce({ response: { data: { detail: 'Verschieben kaputt' } } })
      mockUpdate.mockRejectedValueOnce({ response: { data: { detail: 'Speichern kaputt' } } })
      const w = await mountView()

      await w.findAll('button[aria-label^="Nach unten verschieben"]')[0]?.trigger('click')
      await flushPromises()
      expect(mockToastAdd).toHaveBeenLastCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'Verschieben kaputt' }),
      )

      await w.findAll('button[aria-label^="Bearbeiten"]')[0]?.trigger('click')
      await flushPromises()
      await clickDialogButton('Speichern')
      expect(mockToastAdd).toHaveBeenLastCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'Speichern kaputt' }),
      )
      expect(mockList).toHaveBeenCalledOnce()
    })

    it('uses the specific fallback texts when the failure carries no API reason', async () => {
      mockMove.mockRejectedValueOnce(new Error('offline'))
      mockUpdate.mockRejectedValueOnce(new Error('offline'))
      const w = await mountView()

      await w.findAll('button[aria-label^="Nach unten verschieben"]')[0]?.trigger('click')
      await flushPromises()
      expect(mockToastAdd).toHaveBeenLastCalledWith(
        expect.objectContaining({ detail: 'Verschieben fehlgeschlagen.' }),
      )

      await w.findAll('button[aria-label^="Bearbeiten"]')[0]?.trigger('click')
      await flushPromises()
      await clickDialogButton('Speichern')
      expect(mockToastAdd).toHaveBeenLastCalledWith(
        expect.objectContaining({ detail: 'Speichern fehlgeschlagen.' }),
      )
    })

    it('limits the new quote and its author to what the API accepts', async () => {
      const w = await mountView()

      expect(w.find('input[aria-label="Neues Zitat"]').attributes('maxlength')).toBe('500')
      expect(w.find('input[aria-label="Urheber des neuen Zitats"]').attributes('maxlength')).toBe(
        '100',
      )
    })

    it('does not add anything while a field is blank, even when asked directly', async () => {
      const w = await mountView()
      await w.find('input[aria-label="Neues Zitat"]').setValue('Nur ein Zitat')
      const vm = w.vm as unknown as { addQuote: () => Promise<void> }

      await vm.addQuote()

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('names the move buttons after their quote', async () => {
      const w = await mountView()

      expect(w.find('button[aria-label="Nach unten verschieben: Erstes Zitat."]').exists()).toBe(
        true,
      )
      expect(w.find('button[aria-label="Nach oben verschieben: Zweites Zitat."]').exists()).toBe(
        true,
      )
    })
  })
})
