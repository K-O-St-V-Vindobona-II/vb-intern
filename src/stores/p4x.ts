import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useP4xStore = defineStore('p4x', () => {
  const showInactive = ref(false)

  const stored = sessionStorage.getItem('p4x-showInactive')
  if (stored === 'true') {
    showInactive.value = true
  }

  const toggleInactive = () => {
    showInactive.value = !showInactive.value
    sessionStorage.setItem('p4x-showInactive', String(showInactive.value))
  }

  return { showInactive, toggleInactive }
})
