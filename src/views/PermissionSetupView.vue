<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import systemService from '@/services/systemService'
import type { PermissionRuleResponse } from '@/services/systemService'
import { formatApiError } from '@/utils/formatters'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Message from 'primevue/message'

const toast = useToast()
const loading = ref(true)
const rules = ref<PermissionRuleResponse[]>([])
const devSuperuserCn = ref<string | null>(null)

onMounted(async () => {
  try {
    const resp = await systemService.getPermissionRules()
    rules.value = resp.data.rules
    devSuperuserCn.value = resp.data.dev_superuser_cn
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

    <Message v-if="devSuperuserCn" severity="info" :closable="false" class="dev-superuser-notice">
      {{ devSuperuserCn }} hat in der dev-Umgebung automatisch alle Berechtigungen.
    </Message>

    <DataTable v-if="!loading" :value="rules" striped-rows size="small" scrollable>
      <Column header="Berechtigung" style="min-width: 12rem; vertical-align: top">
        <template #body="{ data }">
          <Tag :value="data.permission" severity="info" class="perm-tag" />
        </template>
      </Column>
      <Column
        field="description"
        header="Bedingung"
        style="min-width: 14rem; vertical-align: top"
      />
      <Column header="Berechtigte" style="min-width: 24rem">
        <template #body="{ data }">
          <div v-for="cn in data.cns" :key="cn" class="cn-row">{{ cn }}</div>
          <template v-if="!data.cns.length">–</template>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.perm-setup {
  max-width: 1100px;
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

.perm-tag {
  font-size: 0.8rem;
}

.dev-superuser-notice {
  margin-bottom: 1rem;
}

.cn-row {
  white-space: nowrap;
}
</style>
