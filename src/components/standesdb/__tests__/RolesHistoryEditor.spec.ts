import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RolesHistoryEditor from '../RolesHistoryEditor.vue'
import PrimeVue from 'primevue/config'

const roles = [
  { id: 'senior', group: 'chc', label: 'Senior', order: 1 },
  { id: 'fuchsmajor', group: 'chc', label: 'Fuchsmajor', order: 2 },
  { id: 'phil-senior', group: 'philchc', label: 'Phil-Senior', order: 3 },
]

const mountWith = (props: Record<string, any>) =>
  mount(RolesHistoryEditor, {
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

describe('RolesHistoryEditor', () => {
  it('shows section label', () => {
    const w = mountWith({ modelValue: [], roles })
    expect(w.text()).toContain('Chargen, Funktionen, Kommissionen')
    w.unmount()
  })

  it('shows column headers', () => {
    const w = mountWith({ modelValue: [], roles })
    expect(w.text()).toContain('von')
    expect(w.text()).toContain('bis')
    expect(w.text()).toContain('Gruppe')
    expect(w.text()).toContain('Rolle')
    w.unmount()
  })

  it('capitalizes group values', () => {
    const w = mountWith({
      modelValue: [{ id: 'senior', startdate: '2020-02-01', enddate: '2020-07-31' }],
      roles,
    })
    expect(w.text()).toContain('Chc')
    w.unmount()
  })

  it('shows "laufend" for entries without enddate', () => {
    const w = mountWith({
      modelValue: [{ id: 'senior', startdate: '2020-02-01', enddate: null }],
      roles,
    })
    expect(w.text()).toContain('laufend')
    w.unmount()
  })

  it('formats dates in German', () => {
    const w = mountWith({
      modelValue: [{ id: 'senior', startdate: '2020-02-01', enddate: '2020-07-31' }],
      roles,
    })
    expect(w.text()).toContain('Februar')
    w.unmount()
  })

  it('shows add button when not readonly', () => {
    const w = mountWith({ modelValue: [], roles })
    const addBtns = w.findAll('button').filter((b) => b.find('.pi-plus').exists())
    expect(addBtns.length).toBeGreaterThan(0)
    w.unmount()
  })

  it('hides action column in readonly mode', () => {
    const w = mountWith({
      modelValue: [{ id: 'senior', startdate: '2020-02-01', enddate: '2020-07-31' }],
      roles,
      readonly: true,
    })
    expect(w.find('.pi-pencil').exists()).toBe(false)
    expect(w.find('.pi-minus').exists()).toBe(false)
    w.unmount()
  })

  it('sorts entries by startdate', () => {
    const w = mountWith({
      modelValue: [
        { id: 'fuchsmajor', startdate: '2021-02-01', enddate: '2021-07-31' },
        { id: 'senior', startdate: '2020-02-01', enddate: '2020-07-31' },
      ],
      roles,
    })
    const text = w.text()
    const seniorPos = text.indexOf('Senior')
    const fmPos = text.indexOf('Fuchsmajor')
    expect(seniorPos).toBeLessThan(fmPos)
    w.unmount()
  })

  it('opens the add dialog with the header "Hinzufügen" and the bis-field visible by default', async () => {
    const w = mountWith({ modelValue: [], roles })
    await w.find('.pi-plus').trigger('click')
    await flushPromises()

    expect(document.querySelector('.p-dialog-title')?.textContent).toBe('Hinzufügen')
    expect(document.querySelectorAll('.dialog-fields .field').length).toBeGreaterThan(3)
    w.unmount()
  })

  it('hides the bis-field once the ongoing checkbox is checked', async () => {
    const w = mountWith({ modelValue: [], roles })
    await w.find('.pi-plus').trigger('click')
    await flushPromises()

    const fieldsBefore = document.querySelectorAll('.dialog-fields .field').length
    await w.findComponent({ name: 'Checkbox' }).vm.$emit('update:modelValue', true)
    await flushPromises()

    expect(document.querySelectorAll('.dialog-fields .field').length).toBe(fieldsBefore - 1)
    w.unmount()
  })

  it('saves a new entry with the selected role and dates, and emits update:modelValue', async () => {
    const w = mountWith({ modelValue: [], roles })
    await w.find('.pi-plus').trigger('click')
    await flushPromises()

    const roleSelect = w.findComponent({ name: 'Select' })
    await roleSelect.vm.$emit('update:modelValue', 'fuchsmajor')

    clickButton('Ok')
    await flushPromises()

    const emitted = w.emitted('update:modelValue')
    expect(emitted).toHaveLength(1)
    const updated = emitted![0]![0] as Array<{
      id: string
      label: string | null
      group: string | null
    }>
    expect(updated).toHaveLength(1)
    expect(updated[0]!.id).toBe('fuchsmajor')
    expect(updated[0]!.label).toBe('Fuchsmajor')
    expect(updated[0]!.group).toBe('chc')
    w.unmount()
  })

  it('opens the edit dialog pre-filled with the clicked entry and updates it on save', async () => {
    const w = mountWith({
      modelValue: [{ id: 'senior', startdate: '2020-02-01', enddate: '2020-07-31' }],
      roles,
    })
    await w.find('.pi-pencil').trigger('click')
    await flushPromises()

    expect(document.querySelector('.p-dialog-title')?.textContent).toBe('Bearbeiten')

    const roleSelect = w.findComponent({ name: 'Select' })
    await roleSelect.vm.$emit('update:modelValue', 'fuchsmajor')
    clickButton('Ok')
    await flushPromises()

    const updated = w.emitted('update:modelValue')![0]![0] as Array<{ id: string }>
    expect(updated).toHaveLength(1)
    expect(updated[0]!.id).toBe('fuchsmajor')
    w.unmount()
  })

  it('marks an edited entry as ongoing when it has no enddate', async () => {
    const w = mountWith({
      modelValue: [{ id: 'senior', startdate: '2020-02-01', enddate: null }],
      roles,
    })
    await w.find('.pi-pencil').trigger('click')
    await flushPromises()

    expect(document.querySelectorAll('.dialog-fields .field').length).toBe(3)
    w.unmount()
  })

  it('removes the clicked entry and emits the entries without it', async () => {
    const w = mountWith({
      modelValue: [
        { id: 'senior', startdate: '2020-02-01', enddate: '2020-07-31' },
        { id: 'fuchsmajor', startdate: '2021-02-01', enddate: '2021-07-31' },
      ],
      roles,
    })
    await w.findAll('.pi-minus')[0]!.trigger('click')

    const updated = w.emitted('update:modelValue')![0]![0] as Array<{ id: string }>
    expect(updated).toHaveLength(1)
    expect(updated[0]!.id).toBe('fuchsmajor')
    w.unmount()
  })

  it('closes the dialog via cancel without emitting changes', async () => {
    const w = mountWith({ modelValue: [], roles })
    await w.find('.pi-plus').trigger('click')
    await flushPromises()

    clickButton('Abbrechen')
    await flushPromises()

    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(document.querySelector('.p-dialog')).toBeNull()
    w.unmount()
  })

  it('applies the WS quick-select range to the start/end dates on save', async () => {
    const w = mountWith({ modelValue: [], roles })
    await w.find('.pi-plus').trigger('click')
    await flushPromises()

    const selects = w.findAllComponents({ name: 'Select' })
    const semesterSelect = selects[1]!
    const yearSelect = selects[2]!
    await semesterSelect.vm.$emit('update:modelValue', 'WS')
    await yearSelect.vm.$emit('update:modelValue', 2022)
    await flushPromises()

    clickButton('Ok')
    await flushPromises()

    const updated = w.emitted('update:modelValue')![0]![0] as Array<{
      startdate: string
      enddate: string | null
    }>
    expect(updated[0]!.startdate).toBe('2022-08-01')
    expect(updated[0]!.enddate).toBe('2023-01-31')
    w.unmount()
  })

  describe('form state across dialog openings', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    type SavedEntry = { id: string; startdate: string; enddate: string | null }
    const lastEmitted = (w: ReturnType<typeof mountWith>) =>
      w.emitted('update:modelValue')!.at(-1)![0] as SavedEntry[]

    it('keeps the stored end date when an entry is edited after an ongoing one was opened', async () => {
      const w = mountWith({
        modelValue: [
          { id: 'senior', startdate: '2020-02-01', enddate: null },
          { id: 'senior', startdate: '2021-02-01', enddate: '2021-07-31' },
        ],
        roles,
      })
      await w.findAll('.pi-pencil')[0]!.trigger('click')
      await flushPromises()
      clickButton('Abbrechen')
      await flushPromises()

      await w.findAll('.pi-pencil')[1]!.trigger('click')
      await flushPromises()
      clickButton('Ok')
      await flushPromises()

      const saved = lastEmitted(w).find((e) => e.startdate === '2021-02-01')
      expect(saved?.enddate).toBe('2021-07-31')
      w.unmount()
    })

    it('starts a new entry with the default semester range after an ongoing one was opened', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 8, 23))
      const w = mountWith({
        modelValue: [{ id: 'senior', startdate: '2020-02-01', enddate: null }],
        roles,
      })
      await w.find('.pi-pencil').trigger('click')
      await flushPromises()
      clickButton('Abbrechen')
      await flushPromises()

      await w.find('.pi-plus').trigger('click')
      await flushPromises()
      clickButton('Ok')
      await flushPromises()

      const added = lastEmitted(w).find((e) => e.startdate === '2026-08-01')
      expect(added?.enddate).toBe('2027-01-31')
      w.unmount()
    })

    it('keeps the dates of an edited entry when only the role changes', async () => {
      const w = mountWith({
        modelValue: [{ id: 'senior', startdate: '2020-02-01', enddate: '2020-07-31' }],
        roles,
      })
      await w.find('.pi-pencil').trigger('click')
      await flushPromises()
      await w.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', 'fuchsmajor')
      clickButton('Ok')
      await flushPromises()

      expect(lastEmitted(w)).toEqual([
        expect.objectContaining({
          id: 'fuchsmajor',
          startdate: '2020-02-01',
          enddate: '2020-07-31',
        }),
      ])
      w.unmount()
    })

    it('sets the end date to today when the user checks and then unchecks "laufend"', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 8, 23))
      const w = mountWith({ modelValue: [], roles })
      await w.find('.pi-plus').trigger('click')
      await flushPromises()

      // The new-entry dialog starts with the semester range ending 2027-01-31.
      const checkbox = w.findComponent({ name: 'Checkbox' })
      await checkbox.vm.$emit('update:modelValue', true)
      await flushPromises()
      await checkbox.vm.$emit('update:modelValue', false)
      await flushPromises()
      clickButton('Ok')
      await flushPromises()

      expect(lastEmitted(w)[0]!.enddate).toBe('2026-09-23')
      w.unmount()
    })

    it('replaces the dates with the chosen semester range and ends "laufend" when the quick selection is used', async () => {
      const w = mountWith({
        modelValue: [{ id: 'senior', startdate: '2020-02-01', enddate: null }],
        roles,
      })
      await w.find('.pi-pencil').trigger('click')
      await flushPromises()

      const selects = w.findAllComponents({ name: 'Select' })
      await selects[1]!.vm.$emit('update:modelValue', 'WS')
      await selects[2]!.vm.$emit('update:modelValue', 2022)
      await flushPromises()
      clickButton('Ok')
      await flushPromises()

      expect(lastEmitted(w)).toEqual([
        expect.objectContaining({ startdate: '2022-08-01', enddate: '2023-01-31' }),
      ])
      w.unmount()
    })
  })
})
