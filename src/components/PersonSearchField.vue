<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AutoComplete from 'primevue/autocomplete'

export interface SearchResult {
  id: number
  label: string
  [key: string]: unknown
}

const props = defineProps<{
  searchFn: (query: string) => Promise<SearchResult[]>
  placeholder?: string
  minLength?: number
}>()

const emit = defineEmits<{
  select: [item: SearchResult]
}>()

const query = ref('')
const suggestions = ref<SearchResult[]>([])
const acRef = ref<{ $el?: HTMLElement } | null>(null)

onMounted(() => {
  acRef.value?.$el?.querySelector('input')?.focus()
})

const onComplete = async (event: { query: string }) => {
  const min = props.minLength ?? 3
  if (event.query.length < min) {
    suggestions.value = []
    return
  }
  try {
    suggestions.value = await props.searchFn(event.query)
  } catch {
    suggestions.value = []
  }
}

const onSelect = (event: { value: SearchResult }) => {
  emit('select', event.value)
  query.value = ''
}
</script>

<template>
  <AutoComplete
    ref="acRef"
    v-model="query"
    :suggestions="suggestions"
    option-label="label"
    :placeholder="placeholder ?? 'Suchen (mind. 3 Zeichen)...'"
    :min-length="minLength ?? 3"
    :auto-option-focus="true"
    fluid
    @complete="onComplete"
    @item-select="onSelect"
  />
</template>
