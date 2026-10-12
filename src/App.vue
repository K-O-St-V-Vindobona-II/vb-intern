<script setup lang="ts">
import { RouterView } from 'vue-router'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import ConsoleBanner from '@/components/layout/ConsoleBanner.vue'
</script>

<template>
  <ConsoleBanner />
  <Toast position="bottom-left" style="width: min(25rem, calc(100vw - 2.5rem))" />
  <ConfirmDialog />
  <RouterView />
</template>
