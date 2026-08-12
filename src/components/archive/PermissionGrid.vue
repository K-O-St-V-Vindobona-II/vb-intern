<script setup lang="ts">
import type { OrgRef, StateRef } from '@/types/archive'
import Checkbox from 'primevue/checkbox'

const model = defineModel<string[]>({
  default: () => [],
})

defineProps<{
  orgs: OrgRef[]
  states: StateRef[]
  edit?: boolean
}>()
</script>

<template>
  <table class="perm-grid">
    <thead>
      <tr>
        <th>Status</th>
        <th v-for="org in orgs" :key="org.id">
          {{ org.label }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="state in states" :key="state.id">
        <td>{{ state.label }}</td>
        <td v-for="org in orgs" :key="org.id" class="perm-cell">
          <Checkbox
            v-model="model"
            :value="`${org.id}_${state.id}`"
            :binary="false"
            :disabled="!edit"
          />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.perm-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.perm-grid th,
.perm-grid td {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--app-border-card);
}
.perm-grid th {
  font-weight: 600;
  background: var(--app-surface-subtle);
}
.perm-cell {
  text-align: center;
}
</style>
