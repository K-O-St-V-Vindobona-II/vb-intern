<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

<!--
  Deliberately not scoped: the login, forgot-password and reset-password
  views (rendered inside RouterView) use these classes on their own
  elements, which a scoped layout style cannot reach. Every helper class is
  nested under .auth-wrapper (the root element of each of those views), so
  this stylesheet - which ends up in the app-wide bundle - can never restyle
  an element outside the authentication screens.
-->
<style>
.auth-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--app-surface-subtle);
}

.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 1rem;
}

.auth-wrapper .text-center {
  text-align: center;
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.auth-wrapper .text-muted {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.auth-wrapper .flex-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-wrapper .input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
