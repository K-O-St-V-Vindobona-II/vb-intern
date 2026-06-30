<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import systemService from '@/services/systemService'
import type { PermissionRuleResponse } from '@/services/systemService'
import { formatApiError } from '@/utils/formatters'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'

const toast = useToast()
const loading = ref(true)
const rules = ref<PermissionRuleResponse[]>([])

onMounted(async () => {
  try {
    const resp = await systemService.getPermissionRules()
    rules.value = resp.data
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: formatApiError(e, 'Berechtigungen konnten nicht geladen werden.'),
      life: 5000,
    })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="perm-setup">
    <h2>System</h2>
    <p class="subtitle">Berechtigungs-Konfiguration</p>
    <p class="hint">
      Übersicht aller Berechtigungen und ihrer Vergabe-Bedingungen, abgeleitet aus der aktuellen
      Systemkonfiguration.
    </p>

    <DataTable v-if="!loading" :value="rules" striped-rows size="small" scrollable>
      <Column header="Berechtigung" style="min-width: 12rem">
        <template #body="{ data }">
          <Tag :value="data.permission" severity="info" class="perm-tag" />
        </template>
      </Column>
      <Column field="description" header="Bedingung" style="min-width: 14rem" />
    </DataTable>
  </div>
</template>

<style scoped>
.perm-setup {
  max-width: 800px;
  margin: 0 auto;
}

.subtitle {
  color: var(--p-text-muted-color);
  margin: 0;
}

.hint {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin: 0.5rem 0 1.5rem;
}

.perm-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.perm-tag {
  font-size: 0.8rem;
}
</style>
