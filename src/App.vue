<script setup lang="ts">
import { RouterView } from 'vue-router'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import ConsoleBanner from '@/components/layout/ConsoleBanner.vue'
</script>

<template>
  <ConsoleBanner />
  <Toast position="bottom-left" />
  <ConfirmDialog />
  <RouterView />
</template>
