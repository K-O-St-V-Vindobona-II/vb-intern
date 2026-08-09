<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import standesdbService from '@/services/standesdbService'
import { formatDateTime } from '@/utils/formatters'
import type { MemberChangeRequestSummary } from '@/types/standesdb'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'

const router = useRouter()
const toast = useToast()

const loading = ref(true)
const items = ref<MemberChangeRequestSummary[]>([])

onMounted(async () => {
  try {
    const resp = await standesdbService.listChangeRequests()
    items.value = resp.data.items
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: 'Änderungsanträge konnten nicht geladen werden.',
      life: 5000,
    })
  } finally {
    loading.value = false
  }
})

const openRequest = (item: MemberChangeRequestSummary) => {
  router.push({ name: 'standesdb-change-request-review', params: { id: item.id } })
}
</script>

<template>
  <div class="change-requests-list">
    <h2 class="page-title">Standesdatenbank</h2>
    <h3 class="page-subtitle">Änderungs-Anträge</h3>

    <DataTable
      :value="items"
      :loading="loading"
      striped-rows
      scrollable
      data-key="id"
      class="requests-table"
      @row-click="(e: { data: MemberChangeRequestSummary }) => openRequest(e.data)"
    >
      <template #empty>Keine offenen Änderungsanträge.</template>
      <Column field="member_cn" header="Mitglied" />
      <Column field="member_org_id" header="Organisation" class="col-org">
        <template #body="{ data }">
          <Tag :value="(data.member_org_id ?? '-').toUpperCase()" severity="info" />
        </template>
      </Column>
      <Column field="field_count" header="Felder" class="col-count" />
      <Column field="created_at" header="Eingereicht am" class="col-date">
        <template #body="{ data }">
          {{ data.created_at ? formatDateTime(data.created_at) : '-' }}
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.change-requests-list {
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.page-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  text-align: center;
}

.page-subtitle {
  margin: 0.25rem 0 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-align: center;
}

.requests-table :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.col-org,
.col-count,
.col-date {
  white-space: nowrap;
}
</style>
