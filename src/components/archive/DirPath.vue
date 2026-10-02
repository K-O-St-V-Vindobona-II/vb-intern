<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { PathEntry } from '@/types/archive'

defineProps<{
  path: PathEntry[]
}>()
</script>

<template>
  <nav class="dir-path" aria-label="Verzeichnispfad">
    <RouterLink :to="{ name: 'archive-root' }" class="path-link"> Archiv </RouterLink>
    <template v-for="entry in path" :key="entry.id">
      <span class="path-sep" aria-hidden="true"> / </span>
      <RouterLink :to="{ name: 'archive-dir', params: { id: entry.id } }" class="path-link">
        {{ entry.name }}
      </RouterLink>
    </template>
  </nav>
</template>

<style scoped>
.path-link {
  color: var(--p-primary-color);
  text-decoration: none;
}
.path-link:hover {
  text-decoration: underline;
}
.path-sep {
  color: var(--p-text-muted-color);
}
</style>
