import { ref, computed, type Ref } from 'vue'

export function useShiftSelect<T>(items: Ref<T[]>, idFn: (item: T) => number) {
  const selected = ref(new Set<number>())
  let lastClickedIndex: number | null = null

  const isSelected = (item: T): boolean => selected.value.has(idFn(item))

  const toggle = (index: number, event: MouseEvent) => {
    const id = idFn(items.value[index]!)
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
