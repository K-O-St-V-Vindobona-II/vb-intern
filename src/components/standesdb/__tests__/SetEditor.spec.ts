import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SetEditor from '../SetEditor.vue'
import PrimeVue from 'primevue/config'

const badges = [
  { id: 1, name: 'fuxenband', group: 'jubelband', order: 1 },
  { id: 2, name: 'dankesband', group: 'ehrenzeichen', order: 2 },
]

const mountWith = (props: Record<string, any>) =>
  mount(SetEditor, {
    props,
    global: { plugins: [PrimeVue] },
    attachTo: document.body,
  })

function clickButton(text: string) {
  const btn = Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === text,
  )!
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('SetEditor', () => {
  it('shows title', () => {
    const w = mountWith({
      modelValue: [],
      availableItems: badges,
      title: 'Ehrungen',
      withGroup: true,
      withDate: true,
    })
    expect(w.text()).toContain('Ehrungen')
    w.unmount()
  })

  it('capitalizes group values', () => {
    const w = mountWith({
      modelValue: [{ id: 1, presentationdate: null, presentationdate_accuracy: 0 }],
      availableItems: badges,
      title: 'Ehrungen',
      withGroup: true,
      withDate: true,
    })
    expect(w.text()).toContain('Jubelband')
    w.unmount()
  })

  it('capitalizes name values', () => {
    const w = mountWith({
      modelValue: [{ id: 1, presentationdate: null, presentationdate_accuracy: 0 }],
      availableItems: badges,
      title: 'Schlüssel',
      withDate: false,
    })
    expect(w.text()).toContain('Fuxenband')
    w.unmount()
  })

  it('shows add button when unused items exist', () => {
    const w = mountWith({
      modelValue: [],
      availableItems: badges,
      title: 'Test',
      withDate: false,
    })
    const addBtn = w.find('[aria-label="Hinzufügen"]')
    expect(addBtn.exists()).toBe(true)
    w.unmount()
  })

  it('hides the add button when all items are already used', () => {
    const w = mountWith({
      modelValue: badges.map((b) => ({
        id: b.id,
        presentationdate: null,
        presentationdate_accuracy: 0,
      })),
      availableItems: badges,
      title: 'Test',
      withDate: false,
    })
    expect(w.find('[aria-label="Hinzufügen"]').exists()).toBe(false)
    w.unmount()
  })

  it('shows edit and remove buttons for existing entries', () => {
    const w = mountWith({
      modelValue: [{ id: 1, presentationdate: null, presentationdate_accuracy: 0 }],
      availableItems: badges,
      title: 'Test',
      withDate: false,
    })
    expect(w.find('[aria-label="Bearbeiten"]').exists()).toBe(true)
    expect(w.find('[aria-label="Entfernen"]').exists()).toBe(true)
    w.unmount()
  })

  it('hides buttons in readonly mode', () => {
    const w = mountWith({
      modelValue: [{ id: 1, presentationdate: null, presentationdate_accuracy: 0 }],
      availableItems: badges,
      title: 'Test',
      withDate: false,
      readonly: true,
    })
    expect(w.find('[aria-label="Bearbeiten"]').exists()).toBe(false)
    expect(w.find('[aria-label="Entfernen"]').exists()).toBe(false)
    w.unmount()
  })

  it('shows date column only when withDate is true', () => {
    const withDate = mountWith({
      modelValue: [{ id: 1, presentationdate: '2021-09-17', presentationdate_accuracy: 3 }],
      availableItems: badges,
      title: 'E',
      withGroup: true,
      withDate: true,
    })
    const withoutDate = mountWith({
      modelValue: [{ id: 1, presentationdate: null, presentationdate_accuracy: 0 }],
      availableItems: badges,
      title: 'S',
      withDate: false,
    })
    expect(withDate.text()).toContain('Datum')
    expect(withoutDate.text()).not.toContain('Datum')
    withDate.unmount()
    withoutDate.unmount()
  })

  it('opens the add dialog pre-selecting the first unused item', async () => {
    const w = mountWith({ modelValue: [], availableItems: badges, title: 'Test', withDate: false })
    await w.find('[aria-label="Hinzufügen"]').trigger('click')
    await flushPromises()

    expect(document.querySelector('.p-dialog-title')?.textContent).toBe('Hinzufügen')
    const select = w.findComponent({ name: 'Select' })
    expect(select.props('modelValue')).toBe(1)
    expect(select.props('disabled')).toBe(false)
    w.unmount()
  })

  it('saves a new entry without a date when withDate is false', async () => {
    const w = mountWith({ modelValue: [], availableItems: badges, title: 'Test', withDate: false })
    await w.find('[aria-label="Hinzufügen"]').trigger('click')
    await flushPromises()

    const select = w.findComponent({ name: 'Select' })
    await select.vm.$emit('update:modelValue', 2)
    clickButton('Ok')
    await flushPromises()

    const updated = w.emitted('update:modelValue')![0]![0] as Array<{
      id: number
      name?: string
      presentationdate_accuracy: number
    }>
    expect(updated).toHaveLength(1)
    expect(updated[0]!.id).toBe(2)
    expect(updated[0]!.name).toBe('dankesband')
    expect(updated[0]!.presentationdate_accuracy).toBe(0)
    w.unmount()
  })

  it('saves a new entry with full date accuracy when withDate is true', async () => {
    const w = mountWith({ modelValue: [], availableItems: badges, title: 'Test', withDate: true })
    await w.find('[aria-label="Hinzufügen"]').trigger('click')
    await flushPromises()

    clickButton('Ok')
    await flushPromises()

    const updated = w.emitted('update:modelValue')![0]![0] as Array<{
      presentationdate_accuracy: number
    }>
    expect(updated[0]!.presentationdate_accuracy).toBe(3)
    w.unmount()
  })

  it('opens the edit dialog for an existing entry with the select disabled', async () => {
    const w = mountWith({
      modelValue: [{ id: 1, presentationdate: '2020-05-10', presentationdate_accuracy: 3 }],
      availableItems: badges,
      title: 'Test',
      withDate: true,
    })
    await w.find('[aria-label="Bearbeiten"]').trigger('click')
    await flushPromises()

    expect(document.querySelector('.p-dialog-title')?.textContent).toBe('Bearbeiten')
    expect(w.findComponent({ name: 'Select' }).props('disabled')).toBe(true)
    w.unmount()
  })

  it('updates the FuzzyDatePicker date/accuracy and persists it on save', async () => {
    const w = mountWith({
      modelValue: [{ id: 1, presentationdate: '2020-05-10', presentationdate_accuracy: 3 }],
      availableItems: badges,
      title: 'Test',
      withDate: true,
    })
    await w.find('[aria-label="Bearbeiten"]').trigger('click')
    await flushPromises()

    const picker = w.findComponent({ name: 'FuzzyDatePicker' })
    await picker.vm.$emit('update:date', '2021-01-01')
    await picker.vm.$emit('update:accuracy', 1)
    clickButton('Ok')
    await flushPromises()

    const updated = w.emitted('update:modelValue')![0]![0] as Array<{
      presentationdate: string | null
      presentationdate_accuracy: number
    }>
    expect(updated).toHaveLength(1)
    expect(updated[0]!.presentationdate).toBe('2021-01-01')
    expect(updated[0]!.presentationdate_accuracy).toBe(1)
    w.unmount()
  })

  it('removes the clicked entry and emits the filtered list', async () => {
    const w = mountWith({
      modelValue: [
        { id: 1, presentationdate: null, presentationdate_accuracy: 0 },
        { id: 2, presentationdate: null, presentationdate_accuracy: 0 },
      ],
      availableItems: badges,
      title: 'Test',
      withDate: false,
    })
    await w.findAll('[aria-label="Entfernen"]')[0]!.trigger('click')

    const updated = w.emitted('update:modelValue')![0]![0] as Array<{ id: number }>
    expect(updated).toHaveLength(1)
    expect(updated[0]!.id).toBe(2)
    w.unmount()
  })

  it('closes the dialog via cancel without emitting changes', async () => {
    const w = mountWith({ modelValue: [], availableItems: badges, title: 'Test', withDate: false })
    await w.find('[aria-label="Hinzufügen"]').trigger('click')
    await flushPromises()

    clickButton('Abbrechen')
    await flushPromises()

    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(document.querySelector('.p-dialog')).toBeNull()
    w.unmount()
  })
})
