<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ amount: number; colorClass?: string }>()

const formatter = new Intl.NumberFormat('de-AT', {
  style: 'currency',
  currency: 'EUR',
})

const formatted = computed(() => formatter.format(props.amount))
// colorClass lets callers opt into a finer-grained severity (e.g. the
// four-step balance scale in FeeBalancesView.vue) without changing the
// default binary green/red behaviour every other caller relies on.
const cssClass = computed(
  () => props.colorClass ?? (props.amount >= 0 ? 'amount-positive' : 'amount-negative'),
)
</script>

<template>
  <span :class="cssClass">
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
.amount-negative-low {
  color: var(--p-yellow-700, #a16207);
}
.amount-negative-mid {
  color: var(--p-red-600, #dc2626);
}
.amount-negative-high {
  color: var(--p-red-700, #b91c1c);
  font-weight: 700;
}
</style>
