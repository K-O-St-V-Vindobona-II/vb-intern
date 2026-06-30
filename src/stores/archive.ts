import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useArchiveStore = defineStore('archive', () => {
  const clipboard = ref<string[]>([])
  const showAdmin = ref(false)

  const addToClipboard = (items: string[]) => {
    const set = new Set(clipboard.value)
    for (const item of items) {
      set.add(item)
    }
    clipboard.value = [...set]
    _persist()
  }

  const removeFromClipboard = (items: string[]) => {
    const remove = new Set(items)
    clipboard.value = clipboard.value.filter((i) => !remove.has(i))
    _persist()
  }

  const emptyClipboard = () => {
    clipboard.value = []
    _persist()
  }

  // sessionStorage (not localStorage): clipboard is transient per browser tab
  const _persist = () => {
    sessionStorage.setItem('archive-clipboard', JSON.stringify(clipboard.value))
  }

  const stored = sessionStorage.getItem('archive-clipboard')
  if (stored) {
    try {
      clipboard.value = JSON.parse(stored)
    } catch {
      clipboard.value = []
    }
  }

  return {
    clipboard,
    showAdmin,
    addToClipboard,
    removeFromClipboard,
    emptyClipboard,
  }
})
