<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppNavbar from '@/components/layout/AppNavbar.vue'
import ProgressBar from 'primevue/progressbar'
import { useLoadingStore } from '@/stores/loading'

const loadingStore = useLoadingStore()
</script>

<template>
  <div class="layout-container">
    <!-- Global Loading Bar -->
    <ProgressBar v-if="loadingStore.isLoading" mode="indeterminate" class="global-loading-bar" />

    <!-- Top Navigation Bar -->
    <header class="layout-header">
      <AppNavbar />
    </header>

    <!-- Main Content Area -->
    <main class="layout-main-content">
      <div class="content-wrapper">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.global-loading-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  z-index: 1001;
  border-radius: 0;
}

.global-loading-bar :deep(.p-progressbar-indeterminate .p-progressbar-value) {
  background: var(--p-primary-color);
}

.layout-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--p-surface-50);
  overflow-x: hidden;
}

.layout-header {
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
}

.layout-main-content {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 1rem; /* Base padding for mobile */
}

.content-wrapper {
  width: 100%;
  max-width: 1400px; /* Match the max-width of the navbar */
}

/* Increase padding for larger screens */
@media (min-width: 768px) {
  .layout-main-content {
    padding: 2rem;
  }
}
</style>
