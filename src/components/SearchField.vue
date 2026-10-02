<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import AutoComplete from 'primevue/autocomplete'

export interface SearchResult {
  id: number | string
  label: string
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    searchFn: (query: string) => Promise<SearchResult[]>
    placeholder?: string
    minLength?: number
  }>(),
  { placeholder: undefined, minLength: 3 },
)

const emit = defineEmits<{
  select: [item: SearchResult]
}>()

const query = ref('')
const suggestions = ref<SearchResult[]>([])
const acRef = ref<{ $el?: HTMLElement } | null>(null)

// The default hint follows minLength, so it never promises a different
// threshold than the one actually enforced.
const placeholderText = computed(
  () => props.placeholder ?? `Suchen (mind. ${props.minLength} Zeichen)...`,
)

// Only the newest completion request may write the suggestions: answers
// arrive in any order, and a slow answer for an outdated query would
// otherwise replace the suggestions of the query the user sees.
let latestRequestId = 0

onMounted(() => {
  acRef.value?.$el?.querySelector('input')?.focus()
})

const onComplete = async (event: { query: string }) => {
  const requestId = ++latestRequestId
  if (event.query.length < props.minLength) {
    suggestions.value = []
    return
  }
  try {
    const results = await props.searchFn(event.query)
    if (requestId !== latestRequestId) return
    suggestions.value = results
  } catch {
    if (requestId !== latestRequestId) return
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
    :placeholder="placeholderText"
    :min-length="minLength"
    :auto-option-focus="true"
    fluid
    @complete="onComplete"
    @item-select="onSelect"
  />
</template>
