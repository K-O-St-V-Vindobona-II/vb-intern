<script setup lang="ts">
import type { P4xCategory } from '@/types/p4x'

defineProps<{
  category: P4xCategory | undefined
  amount?: number | null
  direct?: boolean
}>()

const formatCurrency = (val: number): string =>
  new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(val)
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
    <i v-if="direct" class="pi pi-check" style="font-size: 0.7rem; margin-right: 0.25rem" />
    <i v-else class="pi pi-filter" style="font-size: 0.7rem; margin-right: 0.25rem" />
    {{ category.label }}
    <span v-if="amount != null"> ({{ formatCurrency(amount) }})</span>
  </span>
</template>

<style scoped>
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
