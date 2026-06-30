import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useLoadingStore = defineStore('loading', () => {
  const activeRequests = ref(0)

  const isLoading = computed(() => activeRequests.value > 0)

  const startLoading = () => {
    activeRequests.value++
  }

  const stopLoading = () => {
    if (activeRequests.value > 0) {
      activeRequests.value--
    }
  }

  return { activeRequests, isLoading, startLoading, stopLoading }
})
