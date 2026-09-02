import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import QuotesAdminView from '../QuotesAdminView.vue'

const FIRST_QUOTE_ID = '0199a1c2-0000-7000-8000-000000000001'
const SECOND_QUOTE_ID = '0199a1c2-0000-7000-8000-000000000002'
const THIRD_QUOTE_ID = '0199a1c2-0000-7000-8000-000000000003'

const baseQuotes = [
  { id: FIRST_QUOTE_ID, quote: 'Erstes Zitat.', author: 'Autor Eins' },
  { id: SECOND_QUOTE_ID, quote: 'Zweites Zitat.', author: 'Autor Zwei' },
]

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
      global: { plugins: [PrimeVue, ToastService, createPinia()] },
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
    const downButtons = w.findAll('button[aria-label="Nach unten verschieben"]')
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
})
