import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import FuzzyDatePicker from '../FuzzyDatePicker.vue'
import PrimeVue from 'primevue/config'

const mountWith = (props: Record<string, any>) =>
  mount(FuzzyDatePicker, {
    props,
    global: { plugins: [PrimeVue] },
    attachTo: document.body,
  })

const inputValue = (w: ReturnType<typeof mount>) =>
  (w.find('input').element as HTMLInputElement).value

async function openPopover(w: ReturnType<typeof mountWith>) {
  await w.find('.fuzzy-trigger').trigger('click')
  await flushPromises()
}

describe('FuzzyDatePicker', () => {
  it('shows "unbekannt" when accuracy is 0', () => {
    const w = mountWith({ date: '2020-01-15', accuracy: 0, label: 'Test', readonly: true })
    expect(inputValue(w)).toBe('unbekannt')
    w.unmount()
  })

  it('shows only year when accuracy is 1', () => {
    const w = mountWith({ date: '1978-07-05', accuracy: 1, label: 'Geburtsdatum', readonly: true })
    expect(inputValue(w)).toBe('1978')
    w.unmount()
  })

  it('shows month and year when accuracy is 2', () => {
    const w = mountWith({ date: '1978-07-05', accuracy: 2, label: 'Geburtsdatum', readonly: true })
    const val = inputValue(w)
    expect(val).toContain('Juli')
    expect(val).toContain('1978')
    w.unmount()
  })

  it('shows full date when accuracy is 3', () => {
    const w = mountWith({ date: '1978-07-05', accuracy: 3, label: 'Geburtsdatum', readonly: true })
    const val = inputValue(w)
    expect(val).toContain('5')
    expect(val).toContain('Juli')
    expect(val).toContain('1978')
    w.unmount()
  })

  it('shows label text', () => {
    const w = mountWith({ date: null, accuracy: 0, label: 'Aufnahmedatum', readonly: true })
    expect(w.text()).toContain('Aufnahmedatum')
    w.unmount()
  })

  it('renders disabled input when readonly', () => {
    const w = mountWith({ date: '2020-01-01', accuracy: 3, label: 'Test', readonly: true })
    const input = w.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('disabled')).toBeDefined()
    w.unmount()
  })

  it('renders clickable input when not readonly', () => {
    const w = mountWith({ date: '2020-01-01', accuracy: 3, label: 'Test' })
    const input = w.find('.fuzzy-trigger')
    expect(input.exists()).toBe(true)
    w.unmount()
  })

  it('handles null date with accuracy 0', () => {
    const w = mountWith({ date: null, accuracy: 0, label: 'Test', readonly: true })
    expect(inputValue(w)).toBe('unbekannt')
    w.unmount()
  })

  it('uses Austrian month names', () => {
    const w = mountWith({ date: '2020-01-15', accuracy: 2, label: 'Test', readonly: true })
    expect(inputValue(w)).toContain('Jänner')
    w.unmount()
  })

  it('shows only the year checkbox hint when accuracy is 0', async () => {
    const w = mountWith({ date: null, accuracy: 0, label: 'Test' })
    await openPopover(w)

    expect(document.querySelector('.fuzzy-hint')?.textContent?.trim()).toBe('Jahr bekannt')
    expect(w.findAllComponents({ name: 'Select' })).toHaveLength(0)
    w.unmount()
  })

  it('emits accuracy 1 and the year-based date when the year checkbox is checked', async () => {
    const w = mountWith({ date: null, accuracy: 0, label: 'Test' })
    await openPopover(w)

    const checkbox = w.findComponent({ name: 'Checkbox' })
    await checkbox.vm.$emit('update:modelValue', true)

    expect(w.emitted('update:accuracy')![0]).toEqual([1])
    expect(w.emitted('update:date')![0]).toEqual(['2000-01-01'])
    w.unmount()
  })

  it('reveals the month row once accuracy is at least 1', async () => {
    const w = mountWith({ date: '2020-03-10', accuracy: 1, label: 'Test' })
    await openPopover(w)

    expect(document.querySelectorAll('.fuzzy-row').length).toBe(2)
    w.unmount()
  })

  it('emits accuracy 2 and updates the date when the month checkbox is checked', async () => {
    const w = mountWith({ date: '2020-03-10', accuracy: 1, label: 'Test' })
    await openPopover(w)

    const checkboxes = w.findAllComponents({ name: 'Checkbox' })
    await checkboxes[1]!.vm.$emit('update:modelValue', true)

    expect(w.emitted('update:accuracy')![0]).toEqual([2])
    expect(w.emitted('update:date')![0]).toEqual(['2020-03-10'])
    w.unmount()
  })

  it('reveals the day row and full date selects once accuracy is 2', async () => {
    const w = mountWith({ date: '2020-03-10', accuracy: 2, label: 'Test' })
    await openPopover(w)

    expect(document.querySelectorAll('.fuzzy-row').length).toBe(3)
    expect(w.findAllComponents({ name: 'Select' })).toHaveLength(2)
    w.unmount()
  })

  it('unchecking the day checkbox lowers accuracy back to 2', async () => {
    const w = mountWith({ date: '2020-03-10', accuracy: 3, label: 'Test' })
    await openPopover(w)

    const checkboxes = w.findAllComponents({ name: 'Checkbox' })
    await checkboxes[2]!.vm.$emit('update:modelValue', false)

    expect(w.emitted('update:accuracy')![0]).toEqual([2])
    w.unmount()
  })

  it('updates the date when the year select changes at full accuracy', async () => {
    const w = mountWith({ date: '2020-03-10', accuracy: 3, label: 'Test' })
    await openPopover(w)

    const yearSelect = w.findAllComponents({ name: 'Select' })[0]!
    await yearSelect.vm.$emit('update:modelValue', 1999)

    expect(w.emitted('update:date')![0]).toEqual(['1999-03-10'])
    w.unmount()
  })

  it('clamps the day when switching to a shorter month', async () => {
    const w = mountWith({ date: '2020-01-31', accuracy: 3, label: 'Test' })
    await openPopover(w)

    const monthSelect = w.findAllComponents({ name: 'Select' })[1]!
    await monthSelect.vm.$emit('update:modelValue', 2)

    expect(w.emitted('update:date')![0]).toEqual(['2020-02-29'])
    w.unmount()
  })

  it('re-parses the internal year/month/day when the date prop changes externally', async () => {
    const w = mountWith({ date: '2020-03-10', accuracy: 3, label: 'Test' })
    await w.setProps({ date: '2015-06-20' })
    await openPopover(w)

    const yearSelect = w.findAllComponents({ name: 'Select' })[0]!
    expect(yearSelect.props('modelValue')).toBe(2015)
    w.unmount()
  })
})
