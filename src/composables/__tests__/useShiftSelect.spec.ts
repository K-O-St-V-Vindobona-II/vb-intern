import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useShiftSelect } from '@/composables/useShiftSelect'

interface Item {
  id: number
}

function buildItems(count: number) {
  return ref<Item[]>(Array.from({ length: count }, (_, i) => ({ id: i + 1 })))
}

function click(shiftKey = false): MouseEvent {
  return { shiftKey } as MouseEvent
}

describe('useShiftSelect', () => {
  it('starts with nothing selected', () => {
    const items = buildItems(3)
    const { selected, isSelected, allSelected, selectedItems } = useShiftSelect(items, (i) => i.id)

    expect(selected.value.size).toBe(0)
    expect(isSelected(items.value[0]!)).toBe(false)
    expect(allSelected.value).toBe(false)
    expect(selectedItems.value).toEqual([])
  })

  it('toggle selects an unselected item', () => {
    const items = buildItems(3)
    const { toggle, isSelected } = useShiftSelect(items, (i) => i.id)

    toggle(0, click())

    expect(isSelected(items.value[0]!)).toBe(true)
  })

  it('toggle deselects an already-selected item', () => {
    const items = buildItems(3)
    const { toggle, isSelected } = useShiftSelect(items, (i) => i.id)

    toggle(0, click())
    toggle(0, click())

    expect(isSelected(items.value[0]!)).toBe(false)
  })

  it('shift-click selects the full range from the last clicked index', () => {
    const items = buildItems(5)
    const { toggle, isSelected } = useShiftSelect(items, (i) => i.id)

    toggle(1, click())
    toggle(3, click(true))

    expect(isSelected(items.value[0]!)).toBe(false)
    expect(isSelected(items.value[1]!)).toBe(true)
    expect(isSelected(items.value[2]!)).toBe(true)
    expect(isSelected(items.value[3]!)).toBe(true)
    expect(isSelected(items.value[4]!)).toBe(false)
  })

  it('shift-click deselects the full range when the clicked item was already selected', () => {
    const items = buildItems(5)
    const { toggle, isSelected } = useShiftSelect(items, (i) => i.id)

    toggle(1, click())
    toggle(2, click())
    toggle(3, click())
    // Clicking the already-selected item 1 again with shift should deselect 1..3
    toggle(1, click(true))

    expect(isSelected(items.value[1]!)).toBe(false)
    expect(isSelected(items.value[2]!)).toBe(false)
    expect(isSelected(items.value[3]!)).toBe(false)
  })

  it('shift-click on the very first click behaves like a normal toggle (no prior index)', () => {
    const items = buildItems(3)
    const { toggle, isSelected } = useShiftSelect(items, (i) => i.id)

    toggle(1, click(true))

    expect(isSelected(items.value[0]!)).toBe(false)
    expect(isSelected(items.value[1]!)).toBe(true)
    expect(isSelected(items.value[2]!)).toBe(false)
  })

  it('shift-click on the same index as the last click behaves like a normal toggle', () => {
    const items = buildItems(3)
    const { toggle, isSelected } = useShiftSelect(items, (i) => i.id)

    toggle(1, click())
    toggle(1, click(true))

    expect(isSelected(items.value[1]!)).toBe(false)
  })

  it('selectAll selects every item', () => {
    const items = buildItems(3)
    const { selectAll, allSelected, selectedItems } = useShiftSelect(items, (i) => i.id)

    selectAll()

    expect(allSelected.value).toBe(true)
    expect(selectedItems.value).toEqual(items.value)
  })

  it('deselectAll clears the selection and resets the shift anchor', () => {
    const items = buildItems(3)
    const { toggle, selectAll, deselectAll, selected, isSelected } = useShiftSelect(
      items,
      (i) => i.id,
    )

    toggle(1, click())
    selectAll()
    deselectAll()

    expect(selected.value.size).toBe(0)

    // After deselectAll, the shift anchor is reset, so a shift-click acts like a plain toggle.
    toggle(2, click(true))
    expect(isSelected(items.value[0]!)).toBe(false)
    expect(isSelected(items.value[2]!)).toBe(true)
  })

  it('toggleAll selects all when not everything is selected', () => {
    const items = buildItems(3)
    const { toggle, toggleAll, allSelected } = useShiftSelect(items, (i) => i.id)

    toggle(0, click())
    toggleAll()

    expect(allSelected.value).toBe(true)
  })

  it('toggleAll deselects all when everything is already selected', () => {
    const items = buildItems(3)
    const { selectAll, toggleAll, allSelected, selected } = useShiftSelect(items, (i) => i.id)

    selectAll()
    toggleAll()

    expect(allSelected.value).toBe(false)
    expect(selected.value.size).toBe(0)
  })

  it('allSelected is false for an empty item list', () => {
    const items = buildItems(0)
    const { allSelected } = useShiftSelect(items, (i) => i.id)

    expect(allSelected.value).toBe(false)
  })

  it('selectedItems reflects the current selection in item order', () => {
    const items = buildItems(4)
    const { toggle, selectedItems } = useShiftSelect(items, (i) => i.id)

    toggle(0, click())
    toggle(2, click())

    expect(selectedItems.value).toEqual([items.value[0], items.value[2]])
  })
})
