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

    toggle(items.value[0]!, click())

    expect(isSelected(items.value[0]!)).toBe(true)
  })

  it('toggle deselects an already-selected item', () => {
    const items = buildItems(3)
    const { toggle, isSelected } = useShiftSelect(items, (i) => i.id)

    toggle(items.value[0]!, click())
    toggle(items.value[0]!, click())

    expect(isSelected(items.value[0]!)).toBe(false)
  })

  it('shift-click selects the full range from the last clicked item', () => {
    const items = buildItems(5)
    const { toggle, isSelected } = useShiftSelect(items, (i) => i.id)

    toggle(items.value[1]!, click())
    toggle(items.value[3]!, click(true))

    expect(isSelected(items.value[0]!)).toBe(false)
    expect(isSelected(items.value[1]!)).toBe(true)
    expect(isSelected(items.value[2]!)).toBe(true)
    expect(isSelected(items.value[3]!)).toBe(true)
    expect(isSelected(items.value[4]!)).toBe(false)
  })

  it('shift-click deselects the full range when the clicked item was already selected', () => {
    const items = buildItems(5)
    const { toggle, isSelected } = useShiftSelect(items, (i) => i.id)

    toggle(items.value[1]!, click())
    toggle(items.value[2]!, click())
    toggle(items.value[3]!, click())
    // Clicking the already-selected item 1 again with shift should deselect 1..3
    toggle(items.value[1]!, click(true))

    expect(isSelected(items.value[1]!)).toBe(false)
    expect(isSelected(items.value[2]!)).toBe(false)
    expect(isSelected(items.value[3]!)).toBe(false)
  })

  it('shift-click on the very first click behaves like a normal toggle (no prior index)', () => {
    const items = buildItems(3)
    const { toggle, isSelected } = useShiftSelect(items, (i) => i.id)

    toggle(items.value[1]!, click(true))

    expect(isSelected(items.value[0]!)).toBe(false)
    expect(isSelected(items.value[1]!)).toBe(true)
    expect(isSelected(items.value[2]!)).toBe(false)
  })

  it('shift-click on the same item as the last click behaves like a normal toggle', () => {
    const items = buildItems(3)
    const { toggle, isSelected } = useShiftSelect(items, (i) => i.id)

    toggle(items.value[1]!, click())
    toggle(items.value[1]!, click(true))

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

    toggle(items.value[1]!, click())
    selectAll()
    deselectAll()

    expect(selected.value.size).toBe(0)

    // After deselectAll, the shift anchor is reset, so a shift-click acts like a plain toggle.
    toggle(items.value[2]!, click(true))
    expect(isSelected(items.value[0]!)).toBe(false)
    expect(isSelected(items.value[2]!)).toBe(true)
  })

  it('toggleAll selects all when not everything is selected', () => {
    const items = buildItems(3)
    const { toggle, toggleAll, allSelected } = useShiftSelect(items, (i) => i.id)

    toggle(items.value[0]!, click())
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

    toggle(items.value[0]!, click())
    toggle(items.value[2]!, click())

    expect(selectedItems.value).toEqual([items.value[0], items.value[2]])
  })

  it('toggling an item not present in items.value (stale reference) is a no-op', () => {
    const items = buildItems(3)
    const { toggle, selected } = useShiftSelect(items, (i) => i.id)

    toggle({ id: 999 }, click())

    expect(selected.value.size).toBe(0)
  })

  it('toggles the clicked item, not the item at the same position of the source array, when the displayed order differs', () => {
    const items = buildItems(3) // ids 1, 2, 3 in this order
    const { toggle, isSelected } = useShiftSelect(items, (i) => i.id)

    // Simulate a consumer rendering items in a sorted (reversed) order: the
    // user clicks the row showing id 3, which sits at display position 0 but
    // at items.value position 2. Passing the item itself (not the display
    // index) must select id 3, not whatever item happens to sit at
    // items.value[0] (id 1).
    const displayOrder = [...items.value].reverse()
    toggle(displayOrder[0]!, click())

    expect(isSelected(items.value[2]!)).toBe(true) // id 3, correctly toggled
    expect(isSelected(items.value[0]!)).toBe(false) // id 1, must stay untouched
  })
})
