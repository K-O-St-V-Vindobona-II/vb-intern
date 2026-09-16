<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import activityLogService from '@/services/activityLogService'
import type { ActivityLogDetail, ActivityLogEntry } from '@/types/activityLog'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { formatApiError, formatDateTime } from '@/utils/formatters'
import { useToast } from 'primevue/usetoast'

const props = defineProps<{ memberId: string }>()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const memberName = ref('')
const entries = ref<ActivityLogEntry[]>([])
const loading = ref(false)

const detailVisible = ref(false)
const selectedDetail = ref<ActivityLogDetail | null>(null)

const day = computed(() => String(route.query['day'] ?? ''))

const backTarget = computed(() => {
  const [year, month] = day.value.split('-')
  return { name: 'tracking-activity', query: { year, month } }
})

const methodSeverity = (method: string): string => {
  const map: Record<string, string> = {
    POST: 'success',
    PUT: 'info',
    PATCH: 'info',
    DELETE: 'danger',
    GET: 'secondary',
  }
  return map[method] || 'secondary'
}

const fetchEntries = async () => {
  if (!day.value) return
  loading.value = true
  try {
    const detail = await activityLogService.getForMemberDay(props.memberId, day.value)
    memberName.value = detail.member_name
    entries.value = detail.entries
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
  } finally {
    loading.value = false
  }
}

const showDetail = async (entry: ActivityLogEntry) => {
  try {
    selectedDetail.value = await activityLogService.getEntry(entry.id)
    detailVisible.value = true
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
  }
}

watch([() => props.memberId, day], fetchEntries, { immediate: true })
</script>

<template>
  <div>
    <div class="header-row">
      <Button
        icon="pi pi-arrow-left"
        text
        label="zurück"
        aria-label="Zurück zur Übersicht"
        @click="router.push(backTarget)"
      />
      <h2>{{ memberName || 'Aktivität' }}</h2>
    </div>

    <div v-if="entries.length === 0 && !loading" class="empty-state">
      Keine Aktivität an diesem Tag.
    </div>

    <DataTable :value="entries" :loading="loading" data-key="id" striped-rows scrollable>
      <Column field="created_at" header="Zeit">
        <template #body="{ data }">
          {{ formatDateTime(data.created_at) }}
        </template>
      </Column>
      <Column field="request_method" header="Methode">
        <template #body="{ data }">
          <Tag :value="data.request_method" :severity="methodSeverity(data.request_method)" />
        </template>
      </Column>
      <Column field="request_path" header="Pfad" />
      <Column header="">
        <template #body="{ data }">
          <Button
            icon="pi pi-search"
            text
            rounded
            aria-label="Details anzeigen"
            @click="showDetail(data)"
          />
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="detailVisible"
      modal
      header="Aktivitäts-Detail"
      :style="{ width: '50rem' }"
      :breakpoints="{ '960px': '95vw' }"
    >
      <div v-if="selectedDetail" class="detail-content">
        <div class="detail-field">
          <strong>Datum:</strong> {{ formatDateTime(selectedDetail.created_at) }}
        </div>
        <div class="detail-field">
          <strong>Methode:</strong>
          <Tag
            :value="selectedDetail.request_method"
            :severity="methodSeverity(selectedDetail.request_method)"
          />
        </div>
        <div class="detail-field">
          <strong>Pfad:</strong> <code>{{ selectedDetail.request_path }}</code>
        </div>
        <div class="detail-field">
          <strong>Status:</strong> {{ selectedDetail.response_status }}
        </div>
        <div class="detail-field"><strong>IP:</strong> {{ selectedDetail.client_ip }}</div>
        <div v-if="selectedDetail.client_user_agent" class="detail-field">
          <strong>User-Agent:</strong>
          <span class="ua-text">{{ selectedDetail.client_user_agent }}</span>
        </div>
        <div v-if="selectedDetail.request_input" class="detail-field">
          <strong>Request-Daten:</strong>
          <pre class="request-body">{{
            JSON.stringify(selectedDetail.request_input, null, 2)
          }}</pre>
        </div>
        <div v-if="selectedDetail.response_content" class="detail-field">
          <strong>Antwort-Daten:</strong>
          <pre class="request-body">{{
            JSON.stringify(selectedDetail.response_content, null, 2)
          }}</pre>
        </div>
        <div class="detail-field">
          <strong>Speicher:</strong> {{ selectedDetail.memory_usage }} Bytes
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--p-text-muted-color);
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detail-field {
  font-size: 0.9rem;
}

.ua-text {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  word-break: break-all;
}

.request-body {
  background: var(--app-surface-subtle);
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin-top: 0.25rem;
}
</style>
