<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import trackingService from '@/services/trackingService'
import type {
  ActivityLogItem,
  ActivityLogDetail,
  ActivitySession,
  ActivityStats,
} from '@/types/tracking'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import { formatApiError, formatDateTime } from '@/utils/formatters'
import { useToast } from 'primevue/usetoast'

const toast = useToast()

const sessions = ref<ActivitySession[]>([])
const stats = ref<ActivityStats | null>(null)
const rawItems = ref<ActivityLogItem[]>([])
const rawTotal = ref(0)
const rawPage = ref(1)
const rawPageSize = 25

const sessionsDate = ref(new Date())
const rawDateFrom = ref<Date | null>(null)
const rawDateTo = ref<Date | null>(null)

const retentionMonths = ref(6)
const today = new Date()
const minDate = computed(
  () => new Date(today.getFullYear(), today.getMonth() - retentionMonths.value, today.getDate()),
)

const detailVisible = ref(false)
const selectedDetail = ref<ActivityLogDetail | null>(null)

const loading = ref(false)

const expandedSessions = ref<Set<number>>(new Set())

const formatTime = (dateStr: string | null): string => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('de-AT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const toDateStr = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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

const statusSeverity = (status: number): string => {
  if (status < 300) return 'success'
  if (status < 400) return 'info'
  if (status < 500) return 'warn'
  return 'danger'
}

const sortedActionTypes = computed(() => {
  if (!stats.value) return []
  return Object.entries(stats.value.actions_by_type)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
})

const toggleSession = (index: number) => {
  if (expandedSessions.value.has(index)) {
    expandedSessions.value.delete(index)
  } else {
    expandedSessions.value.add(index)
  }
}

const fetchSessions = async () => {
  loading.value = true
  try {
    const result = await trackingService.getActivitySessions({
      date_str: toDateStr(sessionsDate.value),
      page: 1,
      page_size: 100,
    })
    sessions.value = result.items
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
  } finally {
    loading.value = false
  }
}

const fetchStats = async () => {
  try {
    stats.value = await trackingService.getActivityStats()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
  }
}

const fetchRawData = async () => {
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      page: rawPage.value,
      page_size: rawPageSize,
    }
    if (rawDateFrom.value) params['date_from'] = toDateStr(rawDateFrom.value)
    if (rawDateTo.value) params['date_to'] = toDateStr(rawDateTo.value)
    const result = await trackingService.getActivity(params)
    rawItems.value = result.items
    rawTotal.value = result.total
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
  } finally {
    loading.value = false
  }
}

const showDetail = async (item: ActivityLogItem) => {
  try {
    selectedDetail.value = await trackingService.getActivityDetail(item.id)
    detailVisible.value = true
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
  }
}

const onRawPage = (event: { page: number }) => {
  rawPage.value = event.page + 1
  fetchRawData()
}

watch(sessionsDate, fetchSessions)
watch([rawDateFrom, rawDateTo], () => {
  rawPage.value = 1
  fetchRawData()
})

onMounted(async () => {
  try {
    const config = await trackingService.getConfig()
    retentionMonths.value = config.retention_months
  } catch {
    /* fallback to default */
  }
  fetchSessions()
  fetchStats()
  fetchRawData()
})
</script>

<template>
  <div>
    <h2>Aktivitätsprotokoll</h2>
    <p class="retention-hint">
      <i class="pi pi-info-circle" />
      Es werden nur Daten der letzten {{ retentionMonths }} Monate angezeigt.
    </p>

    <TabView>
      <TabPanel header="Timeline" value="timeline">
        <div class="timeline-controls">
          <DatePicker
            v-model="sessionsDate"
            date-format="dd.mm.yy"
            :manual-input="false"
            :min-date="minDate"
            :max-date="today"
            show-icon
          />
        </div>

        <div v-if="sessions.length === 0 && !loading" class="empty-state">
          Keine Aktivität an diesem Tag.
        </div>

        <div class="sessions-list">
          <div v-for="(session, idx) in sessions" :key="idx" class="session-card">
            <div class="session-header" @click="toggleSession(idx)">
              <div class="session-user">
                <i class="pi pi-user session-avatar" />
                <strong>{{ session.member_name }}</strong>
              </div>
              <div class="session-meta">
                <span class="session-time">
                  {{ formatTime(session.started_at) }} — {{ formatTime(session.ended_at) }}
                </span>
                <Tag :value="`${session.action_count} Aktionen`" severity="info" />
                <i
                  :class="expandedSessions.has(idx) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                  class="expand-icon"
                />
              </div>
            </div>

            <div v-if="expandedSessions.has(idx)" class="session-actions">
              <div
                v-for="action in session.actions"
                :key="action.id"
                class="action-item"
                @click="showDetail(action)"
              >
                <Tag
                  :value="action.request_method"
                  :severity="methodSeverity(action.request_method)"
                  class="method-tag"
                />
                <span class="action-label">{{ action.action_label }}</span>
                <Tag
                  :value="String(action.response_status)"
                  :severity="statusSeverity(action.response_status)"
                  class="status-tag"
                />
                <span class="action-time">{{ formatTime(action.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel header="Statistiken" value="stats">
        <div v-if="stats" class="stats-grid">
          <div class="stat-card">
            <span class="stat-value">{{ stats.active_users_today }}</span>
            <span class="stat-label">Aktive User heute</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ stats.total_actions_today }}</span>
            <span class="stat-label">Aktionen heute</span>
          </div>
        </div>

        <h3 v-if="sortedActionTypes.length">Top-Aktionen heute</h3>
        <div class="action-bars">
          <div v-for="[label, count] in sortedActionTypes" :key="label" class="action-bar-row">
            <span class="action-bar-label">{{ label }}</span>
            <div class="action-bar-track">
              <div
                class="action-bar-fill"
                :style="{ width: `${(count / stats!.total_actions_today) * 100}%` }"
              />
            </div>
            <span class="action-bar-count">{{ count }}</span>
          </div>
        </div>
      </TabPanel>

      <TabPanel header="Rohansicht" value="raw">
        <div class="raw-filters">
          <DatePicker
            v-model="rawDateFrom"
            date-format="dd.mm.yy"
            :manual-input="false"
            :min-date="minDate"
            :max-date="today"
            show-icon
            placeholder="Von"
          />
          <DatePicker
            v-model="rawDateTo"
            date-format="dd.mm.yy"
            :manual-input="false"
            :min-date="minDate"
            :max-date="today"
            show-icon
            placeholder="Bis"
          />
        </div>

        <DataTable
          :value="rawItems"
          :loading="loading"
          :lazy="true"
          :paginator="true"
          :rows="rawPageSize"
          :total-records="rawTotal"
          data-key="id"
          striped-rows
          scrollable
          @page="onRawPage"
          @row-click="(e: { data: ActivityLogItem }) => showDetail(e.data)"
        >
          <Column field="created_at" header="Datum">
            <template #body="{ data }">
              {{ data.created_at ? formatDateTime(data.created_at) : '-' }}
            </template>
          </Column>
          <Column field="member_name" header="User" />
          <Column field="action_label" header="Aktion" />
          <Column field="request_method" header="Methode">
            <template #body="{ data }">
              <Tag :value="data.request_method" :severity="methodSeverity(data.request_method)" />
            </template>
          </Column>
          <Column field="response_status" header="Status">
            <template #body="{ data }">
              <Tag
                :value="String(data.response_status)"
                :severity="statusSeverity(data.response_status)"
              />
            </template>
          </Column>
        </DataTable>
      </TabPanel>
    </TabView>

    <Dialog
      v-model:visible="detailVisible"
      modal
      header="Aktivitäts-Detail"
      :style="{ width: '50rem' }"
      :breakpoints="{ '960px': '95vw' }"
    >
      <div v-if="selectedDetail" class="detail-content">
        <div class="detail-field"><strong>Aktion:</strong> {{ selectedDetail.action_label }}</div>
        <div class="detail-field">
          <strong>User:</strong> {{ selectedDetail.member_name || '-' }}
        </div>
        <div class="detail-field">
          <strong>Datum:</strong>
          {{ selectedDetail.created_at ? formatDateTime(selectedDetail.created_at) : '-' }}
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
          <strong>Status:</strong>
          <Tag
            :value="String(selectedDetail.response_status)"
            :severity="statusSeverity(selectedDetail.response_status)"
          />
        </div>
        <div class="detail-field"><strong>IP:</strong> {{ selectedDetail.client_ip }}</div>
        <div v-if="selectedDetail.client_user_agent" class="detail-field">
          <strong>User-Agent:</strong>
          <span class="ua-text">{{ selectedDetail.client_user_agent }}</span>
        </div>
        <div v-if="selectedDetail.request_input" class="detail-field">
          <strong>Request-Body:</strong>
          <pre class="request-body">{{ selectedDetail.request_input }}</pre>
        </div>
        <div v-if="selectedDetail.response_content" class="detail-field">
          <strong>Response:</strong>
          <pre class="request-body">{{ selectedDetail.response_content }}</pre>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.retention-hint {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.timeline-controls {
  margin-bottom: 1rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--p-text-muted-color);
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.session-card {
  border: 1px solid var(--p-surface-200);
  border-radius: 10px;
  overflow: hidden;
  background: var(--p-surface-0);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background-color 0.1s;
}

.session-header:hover {
  background-color: var(--p-surface-50);
}

.session-user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.session-avatar {
  font-size: 1.2rem;
  color: var(--p-primary-color);
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.expand-icon {
  font-size: 0.75rem;
}

.session-actions {
  border-top: 1px solid var(--p-surface-200);
  padding: 0.5rem;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.action-item:hover {
  background-color: var(--p-surface-50);
}

.method-tag {
  min-width: 3.5rem;
  text-align: center;
}

.action-label {
  flex: 1;
}

.action-time {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.stats-grid {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.25rem 2rem;
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 12px;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.action-bars {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.action-bar-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.action-bar-label {
  width: 12rem;
  font-size: 0.85rem;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-bar-track {
  flex: 1;
  height: 8px;
  background: var(--p-surface-100);
  border-radius: 4px;
  overflow: hidden;
}

.action-bar-fill {
  height: 100%;
  background: var(--p-primary-color);
  border-radius: 4px;
  transition: width 0.3s;
}

.action-bar-count {
  width: 2rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-align: right;
}

.raw-filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
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
  background: var(--p-surface-50);
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin-top: 0.25rem;
}

@media (min-width: 768px) {
  .action-bar-label {
    width: 16rem;
  }
}
</style>
