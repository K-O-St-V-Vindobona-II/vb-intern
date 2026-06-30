<script setup lang="ts">
import { ref } from 'vue'
import type { OrgRef, StateRef } from '@/types/archive'
import PermissionGrid from './PermissionGrid.vue'

const model = defineModel<string[]>({
  default: () => [],
})

defineProps<{
  title: string
  orgs: OrgRef[]
  states: StateRef[]
  recursive?: boolean
}>()

const expanded = ref(false)
</script>

<template>
  <div class="perm-viewer">
    <div class="perm-header" @click="expanded = !expanded">
      <i :class="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="perm-caret" />
      <span>{{ title }}</span>
      <span v-if="recursive" class="recursive-badge"> [rekursiv] </span>
    </div>
    <div v-if="expanded" class="perm-body">
      <PermissionGrid v-model="model" :orgs="orgs" :states="states" />
    </div>
  </div>
</template>

<style scoped>
.perm-header {
  cursor: pointer;
  padding: 0.25rem 0;
  user-select: none;
}
.perm-caret {
  font-size: 0.7rem;
  margin-right: 0.4rem;
  color: var(--p-text-muted-color);
}
.recursive-badge {
  color: var(--p-red-500);
  margin-left: 0.3rem;
  font-size: 0.85rem;
}
.perm-body {
  padding: 0.5rem 1rem;
}
</style>
