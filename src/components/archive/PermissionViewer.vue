<script setup lang="ts">
import { ref, useId } from 'vue'
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
const bodyId = `${useId()}-body`
</script>

<template>
  <div class="perm-viewer">
    <button
      type="button"
      class="perm-header"
      :aria-expanded="expanded"
      :aria-controls="bodyId"
      @click="expanded = !expanded"
    >
      <i :class="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="perm-caret" />
      <span>{{ title }}</span>
      <span v-if="recursive" class="recursive-badge"> [rekursiv] </span>
    </button>
    <div v-if="expanded" :id="bodyId" class="perm-body">
      <PermissionGrid v-model="model" :orgs="orgs" :states="states" />
    </div>
  </div>
</template>

<style scoped>
.perm-header {
  display: block;
  width: 100%;
  padding: 0.25rem 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
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
