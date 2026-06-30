<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <span class="warning-label">
    <i class="pi pi-exclamation-triangle" />
    {{ label }}
  </span>
</template>

<style scoped>
.warning-label {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--p-red-600, #dc2626);
  font-size: 0.8rem;
  font-weight: 500;
}
</style>
