import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ParentSelector from '../ParentSelector.vue'
import PrimeVue from 'primevue/config'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const mockSearchParent = vi.fn()
vi.mock('@/services/standesdbService', () => ({
  default: { searchParent: (...args: unknown[]) => mockSearchParent(...args) },
}))

const mountWith = (props: Record<string, any>) =>
  mount(ParentSelector, {
    props,
    global: { plugins: [PrimeVue] },
    attachTo: document.body,
  })

async function openDialog(w: ReturnType<typeof mountWith>) {
  await w.find('button[aria-label="Leibbursch bearbeiten"]').trigger('click')
}

function clickButton(text: string) {
  const btn = Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === text,
  )!
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function clickByAriaLabel(label: string) {
  const btn = document.querySelector(`button[aria-label="${label}"]`) as HTMLElement
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('ParentSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParent.mockResolvedValue({ data: { data: [{ id: 10, cn: 'Treffer v/o Test' }] } })
  })

  it('shows label', () => {
    const w = mountWith({ parentId: 0, parentCn: '', memberId: 1, label: 'Leibbursch' })
    expect(w.text()).toContain('Leibbursch')
    w.unmount()
  })

  it('shows dash when no parent selected', () => {
    const w = mountWith({ parentId: 0, parentCn: '', memberId: 1, label: 'Leibbursch' })
    const input = w.find('.parent-input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('–')
    w.unmount()
  })

  it('shows parent CN when selected', () => {
    const w = mountWith({ parentId: 5, parentCn: 'Max v/o Test', memberId: 1, label: 'Leibbursch' })
    const input = w.find('.parent-input')
    expect((input.element as HTMLInputElement).value).toBe('Max v/o Test')
    w.unmount()
  })

  it('shows hint when memberId is null (new member)', () => {
    const w = mountWith({ parentId: 0, parentCn: '', memberId: null, label: 'Leibbursch' })
    expect(w.text()).toContain('nur auswählbar')
    w.unmount()
  })

  it('shows edit button when not readonly and memberId set', () => {
    const w = mountWith({ parentId: 0, parentCn: '', memberId: 1, label: 'Leibbursch' })
    expect(w.find('button').exists()).toBe(true)
    w.unmount()
  })

  it('hides edit button in readonly mode', () => {
    const w = mountWith({
      parentId: 5,
      parentCn: 'Test',
      memberId: 1,
      label: 'Leibbursch',
      readonly: true,
    })
    const buttons = w.findAll('button')
    expect(buttons.length).toBe(0)
    w.unmount()
  })

  it('makes CN clickable in readonly mode with parent', () => {
    const w = mountWith({
      parentId: 5,
      parentCn: 'Test',
      memberId: 1,
      label: 'Leibbursch',
      readonly: true,
    })
    const input = w.find('.parent-input.clickable')
    expect(input.exists()).toBe(true)
    w.unmount()
  })

  it('navigates to the parent member when the readonly input is clicked', async () => {
    const w = mountWith({
      parentId: 5,
      parentCn: 'Test',
      memberId: 1,
      label: 'Leibbursch',
      readonly: true,
    })
    await w.find('.parent-input.clickable').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({ name: 'standesdb-member-show', params: { id: 5 } })
    w.unmount()
  })

  it('opens the dialog pre-filled with the current parent when the edit button is clicked', async () => {
    const w = mountWith({
      parentId: 5,
      parentCn: 'Aktueller Leibbursch',
      memberId: 1,
      label: 'Leibbursch',
    })
    await openDialog(w)
    await flushPromises()

    expect(document.querySelector('.current-selection')?.textContent).toContain(
      'Aktueller Leibbursch',
    )
    w.unmount()
  })

  it('does not search and clears suggestions for queries shorter than 3 characters', async () => {
    const w = mountWith({ parentId: 0, parentCn: '', memberId: 1, label: 'Leibbursch' })
    await openDialog(w)
    await flushPromises()

    const autocomplete = w.findComponent({ name: 'AutoComplete' })
    await autocomplete.vm.$emit('complete', { query: 'ab' })

    expect(mockSearchParent).not.toHaveBeenCalled()
    w.unmount()
  })

  it('searches for parent candidates once the query reaches 3 characters', async () => {
    const w = mountWith({ parentId: 0, parentCn: '', memberId: 1, label: 'Leibbursch' })
    await openDialog(w)
    await flushPromises()

    const autocomplete = w.findComponent({ name: 'AutoComplete' })
    await autocomplete.vm.$emit('complete', { query: 'Max' })
    await flushPromises()

    expect(mockSearchParent).toHaveBeenCalledWith(1, 'Max')
    w.unmount()
  })

  it('clears the suggestions when the search fails', async () => {
    mockSearchParent.mockRejectedValue(new Error('network'))
    const w = mountWith({ parentId: 0, parentCn: '', memberId: 1, label: 'Leibbursch' })
    await openDialog(w)
    await flushPromises()

    const autocomplete = w.findComponent({ name: 'AutoComplete' })
    await autocomplete.vm.$emit('complete', { query: 'Max' })
    await flushPromises()

    expect(autocomplete.props('suggestions')).toEqual([])
    w.unmount()
  })

  it('selects a candidate from the suggestions and shows it as the current selection', async () => {
    const w = mountWith({ parentId: 0, parentCn: '', memberId: 1, label: 'Leibbursch' })
    await openDialog(w)
    await flushPromises()

    const autocomplete = w.findComponent({ name: 'AutoComplete' })
    await autocomplete.vm.$emit('item-select', { value: { id: 10, cn: 'Treffer v/o Test' } })
    await flushPromises()

    expect(document.querySelector('.current-selection')?.textContent).toContain('Treffer v/o Test')
    w.unmount()
  })

  it('clears the candidate selection via the trash button', async () => {
    const w = mountWith({ parentId: 0, parentCn: '', memberId: 1, label: 'Leibbursch' })
    await openDialog(w)
    await flushPromises()

    const autocomplete = w.findComponent({ name: 'AutoComplete' })
    await autocomplete.vm.$emit('item-select', { value: { id: 10, cn: 'Treffer v/o Test' } })
    await flushPromises()

    clickByAriaLabel('Auswahl löschen')
    await flushPromises()

    expect(document.querySelector('.current-selection')?.textContent?.trim()).toBe('')
    w.unmount()
  })

  it('emits the new parent id/cn and closes the dialog on save', async () => {
    const w = mountWith({ parentId: 0, parentCn: '', memberId: 1, label: 'Leibbursch' })
    await openDialog(w)
    await flushPromises()

    const autocomplete = w.findComponent({ name: 'AutoComplete' })
    await autocomplete.vm.$emit('item-select', { value: { id: 10, cn: 'Treffer v/o Test' } })
    await flushPromises()

    clickButton('Ok')
    await flushPromises()

    expect(w.emitted('update:parentId')).toEqual([[10]])
    expect(w.emitted('update:parentCn')).toEqual([['Treffer v/o Test']])
    expect(document.querySelector('.p-dialog')).toBeNull()
    w.unmount()
  })

  it('closes the dialog via cancel without emitting changes', async () => {
    const w = mountWith({ parentId: 5, parentCn: 'Bestehend', memberId: 1, label: 'Leibbursch' })
    await openDialog(w)
    await flushPromises()

    clickButton('Abbrechen')
    await flushPromises()

    expect(w.emitted('update:parentId')).toBeUndefined()
    expect(w.emitted('update:parentCn')).toBeUndefined()
    w.unmount()
  })
})
