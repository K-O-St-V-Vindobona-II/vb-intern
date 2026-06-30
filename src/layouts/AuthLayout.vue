<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

<style>
.auth-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--p-surface-50);
}

.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 1rem;
}

.text-center {
  text-align: center;
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.text-muted {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.flex-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

:deep(.p-password input) {
  width: 100%;
}
</style>
