<script setup lang="ts">
import type { P4xCategory } from '@/types/p4x'
import { formatEuro } from '@/utils/formatters'

defineProps<{
  category: P4xCategory | undefined
  amount?: number | null
  direct?: boolean
}>()
</script>

<template>
  <span
    v-if="category"
    class="category-badge"
    :style="{
      backgroundColor: category.background_color,
      color: category.text_color,
    }"
  >
    <i
      v-if="direct"
      class="pi pi-check"
      aria-hidden="true"
      style="font-size: 0.7rem; margin-right: 0.25rem"
    />
    <i
      v-else
      class="pi pi-filter"
      aria-hidden="true"
      style="font-size: 0.7rem; margin-right: 0.25rem"
    />
    <span class="visually-hidden">{{
      direct ? 'Direkt zugewiesen: ' : 'Über Filter zugewiesen: '
    }}</span>
    {{ category.label }}
    <span v-if="amount != null"> ({{ formatEuro(amount) }})</span>
  </span>
</template>

<style scoped>
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.category-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
}
</style>
