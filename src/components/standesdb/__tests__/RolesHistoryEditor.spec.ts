import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RolesHistoryEditor from '../RolesHistoryEditor.vue'
import PrimeVue from 'primevue/config'

const roles = [
  { id: 'senior', group: 'chc', label: 'Senior', order: 1 },
  { id: 'fuchsmajor', group: 'chc', label: 'Fuchsmajor', order: 2 },
  { id: 'phil-senior', group: 'philchc', label: 'Phil-Senior', order: 3 },
]

const mountWith = (props: InstanceType<typeof RolesHistoryEditor>['$props']) =>
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

  describe('role list, fallbacks and dates picked by hand', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    type SavedEntry = {
      id: string
      label: string
      group: string
      startdate: string
      enddate: string | null
    }
    const lastEmitted = (w: ReturnType<typeof mountWith>) =>
      w.emitted('update:modelValue')!.at(-1)![0] as SavedEntry[]

    it('groups the roles in the picker by group, in order, with fallbacks for a missing group or label', async () => {
      const w = mountWith({
        modelValue: [],
        roles: [
          { id: 'zweiter', group: null, label: null, order: 2 },
          { id: 'erster', group: 'chc', label: 'Erster', order: 1 },
          { id: 'dritter', group: 'chc', label: 'Dritter', order: 3 },
        ],
      })
      await w.find('.pi-plus').trigger('click')
      await flushPromises()

      expect(w.findComponent({ name: 'Select' }).props('options')).toEqual([
        {
          label: 'chc',
          items: [
            { label: 'Erster', value: 'erster' },
            { label: 'Dritter', value: 'dritter' },
          ],
        },
        { label: 'sonstige', items: [{ label: 'zweiter', value: 'zweiter' }] },
      ])
      w.unmount()
    })

    it('preselects the first role of the list for a new entry and nothing when there are no roles', async () => {
      const withRoles = mountWith({ modelValue: [], roles })
      await withRoles.find('.pi-plus').trigger('click')
      await flushPromises()
      expect(withRoles.findComponent({ name: 'Select' }).props('modelValue')).toBe('senior')
      withRoles.unmount()

      const withoutRoles = mountWith({ modelValue: [], roles: [] })
      await withoutRoles.find('.pi-plus').trigger('click')
      await flushPromises()
      expect(withoutRoles.findComponent({ name: 'Select' }).props('modelValue')).toBe('')
      withoutRoles.unmount()
    })

    it('shows the id and no group for an entry whose role is not in the list', async () => {
      const w = mountWith({
        modelValue: [{ id: 'verschollen', startdate: '2020-02-01', enddate: '2020-07-31' }],
        roles,
      })

      const cells = w.findAll('tbody tr td').map((c) => c.text())
      expect(cells[2]).toBe('')
      expect(cells[3]).toBe('verschollen')
      w.unmount()
    })

    it('proposes the summer semester for a new entry between February and July', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 3, 15))
      const w = mountWith({ modelValue: [], roles })
      await w.find('.pi-plus').trigger('click')
      await flushPromises()

      clickButton('Ok')
      await flushPromises()

      const added = lastEmitted(w)[0]!
      expect(added.startdate).toBe('2026-02-01')
      expect(added.enddate).toBe('2026-07-31')
      w.unmount()
    })

    it('saves the dates the user picks in the two date fields', async () => {
      const w = mountWith({ modelValue: [], roles })
      await w.find('.pi-plus').trigger('click')
      await flushPromises()

      const [start, end] = w.findAllComponents({ name: 'DatePicker' })
      start!.vm.$emit('update:modelValue', new Date(2019, 4, 7))
      end!.vm.$emit('update:modelValue', new Date(2019, 10, 20))
      await flushPromises()
      clickButton('Ok')
      await flushPromises()

      const added = lastEmitted(w)[0]!
      expect(added.startdate).toBe('2019-05-07')
      expect(added.enddate).toBe('2019-11-20')
      w.unmount()
    })

    it('applies the summer semester quick selection of the chosen year', async () => {
      const w = mountWith({ modelValue: [], roles })
      await w.find('.pi-plus').trigger('click')
      await flushPromises()

      const [, semesterSelect, yearSelect] = w.findAllComponents({ name: 'Select' })
      semesterSelect!.vm.$emit('update:modelValue', 'WS')
      semesterSelect!.vm.$emit('update:modelValue', 'SS')
      yearSelect!.vm.$emit('update:modelValue', 2018)
      await flushPromises()
      clickButton('Ok')
      await flushPromises()

      const added = lastEmitted(w)[0]!
      expect(added.startdate).toBe('2018-02-01')
      expect(added.enddate).toBe('2018-07-31')
      w.unmount()
    })

    it('closes the dialog without saving when it asks to be hidden', async () => {
      const w = mountWith({ modelValue: [], roles })
      await w.find('.pi-plus').trigger('click')
      await flushPromises()
      const dialog = w.findComponent({ name: 'Dialog' })
      expect(dialog.props('visible')).toBe(true)

      dialog.vm.$emit('update:visible', false)
      await flushPromises()

      expect(dialog.props('visible')).toBe(false)
      expect(w.emitted('update:modelValue')).toBeUndefined()
      w.unmount()
    })

    it('saves an ongoing entry without an end date', async () => {
      const w = mountWith({ modelValue: [], roles })
      await w.find('.pi-plus').trigger('click')
      await flushPromises()

      await w.findComponent({ name: 'Checkbox' }).vm.$emit('update:modelValue', true)
      await flushPromises()
      clickButton('Ok')
      await flushPromises()

      expect(lastEmitted(w)[0]!.enddate).toBeNull()
      w.unmount()
    })
  })

  describe('range validation', () => {
    async function openAddDialog() {
      const w = mountWith({ modelValue: [], roles })
      await w.find('.pi-plus').trigger('click')
      await flushPromises()
      return w
    }

    async function setRange(w: ReturnType<typeof mountWith>, start: Date, end: Date) {
      const pickers = w.findAllComponents({ name: 'DatePicker' })
      await pickers[0]!.vm.$emit('update:modelValue', start)
      await pickers[1]!.vm.$emit('update:modelValue', end)
      await flushPromises()
    }

    const okButton = () =>
      Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Ok')!

    it.each([
      ['before', new Date(2022, 0, 9)],
      ['on the same day as', new Date(2022, 0, 10)],
    ])(
      'rejects an end date %s the start date: hint shown, Ok disabled, nothing emitted',
      async (_label, end) => {
        const w = await openAddDialog()

        await setRange(w, new Date(2022, 0, 10), end)

        expect(document.querySelector('.field-error')?.textContent).toContain('nach dem Startdatum')
        expect(okButton().disabled).toBe(true)
        okButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flushPromises()
        expect(w.emitted('update:modelValue')).toBeUndefined()
        w.unmount()
      },
    )

    it('accepts an end date after the start date', async () => {
      const w = await openAddDialog()

      await setRange(w, new Date(2022, 0, 10), new Date(2022, 0, 11))

      expect(document.querySelector('.field-error')).toBeNull()
      expect(okButton().disabled).toBe(false)
      w.unmount()
    })

    it('marks both pickers invalid and links the end picker to the announced hint', async () => {
      const w = await openAddDialog()

      await setRange(w, new Date(2022, 0, 10), new Date(2022, 0, 9))

      const pickers = w.findAllComponents({ name: 'DatePicker' })
      expect(pickers.map((p) => p.props('invalid'))).toEqual([true, true])
      const hint = document.querySelector('.field-error')!
      expect(hint.getAttribute('role')).toBe('alert')
      expect(hint.id).not.toBe('')
      expect(pickers[1]!.attributes('aria-describedby')).toBe(hint.id)

      await setRange(w, new Date(2022, 0, 10), new Date(2022, 0, 11))

      expect(pickers.map((p) => p.props('invalid'))).toEqual([false, false])
      expect(pickers[1]!.attributes('aria-describedby')).toBeUndefined()
      w.unmount()
    })

    it('does not check the range while the entry is ongoing', async () => {
      const w = await openAddDialog()
      await setRange(w, new Date(2022, 0, 10), new Date(2021, 0, 1))
      expect(okButton().disabled).toBe(true)

      await w.findComponent({ name: 'Checkbox' }).vm.$emit('update:modelValue', true)
      await flushPromises()

      expect(okButton().disabled).toBe(false)
      w.unmount()
    })
  })

  describe('entries that share role and start date', () => {
    const twins = [
      { id: 'senior', startdate: '2020-02-01', enddate: '2020-03-31' },
      { id: 'senior', startdate: '2020-02-01', enddate: '2020-07-31' },
    ]

    it('regression: edits the entry that was clicked, not the first with the same role and start date', async () => {
      const w = mountWith({ modelValue: twins, roles })
      await w.findAll('.pi-pencil')[1]!.trigger('click')
      await flushPromises()
      await w.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', 'fuchsmajor')
      clickButton('Ok')
      await flushPromises()

      const saved = w.emitted('update:modelValue')![0]![0] as Array<{ id: string; enddate: string }>
      expect(saved.map((e) => [e.id, e.enddate])).toEqual([
        ['senior', '2020-03-31'],
        ['fuchsmajor', '2020-07-31'],
      ])
      w.unmount()
    })

    it('regression: removes the entry that was clicked, not the first with the same role and start date', async () => {
      const w = mountWith({ modelValue: twins, roles })

      await w.findAll('.pi-minus')[1]!.trigger('click')

      const saved = w.emitted('update:modelValue')![0]![0] as Array<{ enddate: string }>
      expect(saved.map((e) => e.enddate)).toEqual(['2020-03-31'])
      w.unmount()
    })
  })

  it('names the quick selection controls and renders the headings as plain text', async () => {
    const w = mountWith({
      modelValue: [{ id: 'senior', startdate: '2020-02-01', enddate: '2020-07-31' }],
      roles,
    })
    expect(w.find('.set-label').element.tagName).toBe('SPAN')

    await w.find('.pi-pencil').trigger('click')
    await flushPromises()

    const selects = w.findAllComponents({ name: 'Select' })
    expect(selects.slice(1).map((s) => s.props('ariaLabel'))).toEqual(['Semester', 'Jahr'])
    expect(document.querySelector('.quick-label')!.tagName).toBe('SPAN')
    w.unmount()
  })

  it('leaves the list untouched when asked to remove an entry that is not part of it', () => {
    const modelValue = [{ id: 'senior', startdate: '2020-02-01', enddate: '2020-07-31' }]
    const w = mountWith({ modelValue, roles })
    const vm = w.vm as unknown as { remove: (entry: unknown) => void }

    vm.remove({ id: 'senior', startdate: '2020-02-01', enddate: '2020-07-31' })

    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('names the icon-only buttons and links every dialog label to its control', async () => {
    const w = mountWith({
      modelValue: [{ id: 'senior', startdate: '2020-02-01', enddate: '2020-07-31' }],
      roles,
    })
    expect(w.find('.pi-plus').element.closest('button')!.getAttribute('aria-label')).toBe(
      'Hinzufügen',
    )
    expect(w.find('.pi-pencil').element.closest('button')!.getAttribute('aria-label')).toBe(
      'Bearbeiten',
    )
    expect(w.find('.pi-minus').element.closest('button')!.getAttribute('aria-label')).toBe(
      'Entfernen',
    )

    await w.find('.pi-pencil').trigger('click')
    await flushPromises()

    const labels = Array.from(
      document.querySelectorAll<HTMLLabelElement>('.dialog-fields label[for]'),
    )
    expect(labels.map((l) => l.textContent?.trim())).toEqual(['Rolle', 'von', 'bis'])
    for (const label of labels) {
      expect(document.getElementById(label.htmlFor)).not.toBeNull()
    }
    w.unmount()
  })
})
