import { shallowRef, computed, type Ref } from 'vue'

export function useShiftSelect<T, Id = number>(items: Ref<T[]>, idFn: (item: T) => Id) {
  // shallowRef, not ref: the Set is always replaced wholesale (never
  // mutated in place), and Vue's ref<T>() can't safely unwrap an
  // unconstrained generic Id, which shallowRef sidesteps entirely.
  const selected = shallowRef(new Set<Id>())
  let lastClickedIndex: number | null = null

  const isSelected = (item: T): boolean => selected.value.has(idFn(item))

  // Takes the clicked item itself, not its row position: a host table such as a
  // sortable DataTable reports the position within the order currently shown,
  // which differs from items.value as soon as a column is sorted. The item is
  // resolved by id, so the toggle always targets the row the user clicked. A
  // shift range is still walked in items.value order, so after sorting it can
  // differ from the visually contiguous rows.
  const toggle = (item: T, event: MouseEvent) => {
    const id = idFn(item)
    const index = items.value.findIndex((candidate) => idFn(candidate) === id)
    if (index === -1) return

    // Toggle direction based on clicked item's state, applied to entire range
    const willSelect = !selected.value.has(id)

    if (event.shiftKey && lastClickedIndex !== null && lastClickedIndex !== index) {
      const from = Math.min(lastClickedIndex, index)
      const to = Math.max(lastClickedIndex, index)
      const next = new Set(selected.value)
      for (let i = from; i <= to; i++) {
        const itemId = idFn(items.value[i]!)
        if (willSelect) {
          next.add(itemId)
        } else {
          next.delete(itemId)
        }
      }
      selected.value = next
    } else {
      const next = new Set(selected.value)
      if (willSelect) {
        next.add(id)
      } else {
        next.delete(id)
      }
      selected.value = next
    }

    lastClickedIndex = index
  }

  const selectAll = () => {
    selected.value = new Set(items.value.map(idFn))
  }

  const deselectAll = () => {
    selected.value = new Set()
    lastClickedIndex = null
  }

  const toggleAll = () => {
    if (selected.value.size === items.value.length) {
      deselectAll()
    } else {
      selectAll()
    }
  }

  const allSelected = computed(
    () => items.value.length > 0 && selected.value.size === items.value.length,
  )

  const selectedItems = computed(() => items.value.filter((item) => selected.value.has(idFn(item))))

  return {
    selected,
    isSelected,
    toggle,
    selectAll,
    deselectAll,
    toggleAll,
    allSelected,
    selectedItems,
  }
}
