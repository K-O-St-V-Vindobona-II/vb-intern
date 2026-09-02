<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { PathEntry } from '@/types/archive'

defineProps<{
  path: PathEntry[]
}>()

const router = useRouter()

const goToDir = (id: string | null) => {
  if (id === null) {
    router.push({ name: 'archive-root' })
  } else {
    router.push({
      name: 'archive-dir',
      params: { id },
    })
  }
}
</script>

<template>
  <span class="dir-path">
    <a class="path-link" @click.prevent="goToDir(null)"> Archiv </a>
    <template v-for="entry in path" :key="entry.id">
      <span class="path-sep"> / </span>
      <a class="path-link" @click.prevent="goToDir(entry.id)">
        {{ entry.name }}
      </a>
    </template>
  </span>
</template>

<style scoped>
.path-link {
  color: var(--p-primary-color);
  cursor: pointer;
  text-decoration: none;
}
.path-link:hover {
  text-decoration: underline;
}
.path-sep {
  color: var(--p-text-muted-color);
}
</style>
