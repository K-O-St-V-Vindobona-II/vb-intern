<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ amount: number }>()

const formatter = new Intl.NumberFormat('de-AT', {
  style: 'currency',
  currency: 'EUR',
})

const formatted = computed(() => formatter.format(props.amount))
</script>

<template>
  <span :class="amount >= 0 ? 'amount-positive' : 'amount-negative'">
    {{ formatted }}
  </span>
</template>

<style scoped>
.amount-positive {
  color: var(--p-green-600, #16a34a);
}
.amount-negative {
  color: var(--p-red-600, #dc2626);
}
</style>
