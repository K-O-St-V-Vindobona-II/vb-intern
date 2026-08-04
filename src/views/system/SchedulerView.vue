<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import systemService from '@/services/systemService'
import type { ScheduledJobResponse, ScheduledJobRunListItem } from '@/services/systemService'
import { formatApiError, formatDateTime } from '@/utils/formatters'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const toast = useToast()
const loading = ref(true)
const jobs = ref<ScheduledJobResponse[]>([])
const backupLoading = ref(false)

onMounted(async () => {
  try {
    const resp = await systemService.getScheduledJobs()
    jobs.value = resp.data
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: formatApiError(e, 'Scheduler-Daten konnten nicht geladen werden.'),
      life: 5000,
    })
  } finally {
    loading.value = false
  }
})

const triggerBackup = async () => {
  backupLoading.value = true
  try {
    const resp = await systemService.triggerBackup()
    toast.add({
      severity: 'success',
      summary: `Backup erstellt: ${resp.data.backup_name}`,
      life: 5000,
    })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: formatApiError(e, 'Backup konnte nicht erstellt werden.'),
      life: 5000,
    })
  } finally {
    backupLoading.value = false
  }
}

const exitCodeSeverity = (exitCode: number) => (exitCode === 0 ? 'success' : 'danger')

const historyVisible = ref(false)
const historyJobId = ref('')
const historyItems = ref<ScheduledJobRunListItem[]>([])
const historyTotal = ref(0)
const historyPage = ref(1)
const historyLoading = ref(false)
const historyPageSize = 25

const fetchHistory = async () => {
  historyLoading.value = true
  try {
    const resp = await systemService.getJobRunHistory(historyJobId.value, {
      page: historyPage.value,
      page_size: historyPageSize,
    })
    historyItems.value = resp.data.items
    historyTotal.value = resp.data.total
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: formatApiError(e, 'Historie konnte nicht geladen werden.'),
      life: 5000,
    })
  } finally {
    historyLoading.value = false
  }
}

const showHistory = (jobId: string) => {
  historyJobId.value = jobId
  historyPage.value = 1
  historyVisible.value = true
  fetchHistory()
}

const onHistoryPage = (event: { page: number }) => {
  historyPage.value = event.page + 1
  fetchHistory()
}
</script>

<template>
  <div class="scheduler-view">
    <h2>System</h2>
    <p class="subtitle">Scheduler</p>
    <p class="hint">Registrierte Hintergrund-Jobs und ihre nächste geplante Ausführung.</p>

    <div class="backup-action">
      <Button
        label="Backup jetzt erstellen"
        icon="pi pi-database"
        :loading="backupLoading"
        @click="triggerBackup"
      />
    </div>

    <div v-if="!loading" class="job-grid">
      <div v-for="job in jobs" :key="job.id" class="job-card">
        <div class="job-card-header">
          <i class="pi pi-clock job-icon" />
          <Tag :value="job.id" severity="secondary" class="job-tag" />
        </div>
        <p v-if="job.description" class="job-description">
          {{ job.description }}
        </p>
        <div class="job-details">
          <div class="job-detail">
            <span class="job-detail-label">Zeitplan</span>
            <span class="job-detail-value">{{ job.trigger }}</span>
          </div>
          <div class="job-detail">
            <span class="job-detail-label">Nächste Ausführung</span>
            <span class="job-detail-value">{{ job.next_run ?? '–' }}</span>
          </div>
          <div class="job-detail">
            <span class="job-detail-label">Letzter Lauf</span>
            <span class="job-detail-value">
              <template v-if="job.last_run">
                <Tag
                  :value="job.last_run.exit_code === 0 ? 'OK' : 'FEHLER'"
                  :severity="exitCodeSeverity(job.last_run.exit_code)"
                  class="last-run-tag"
                />
                {{ formatDateTime(job.last_run.finished_at) }}
              </template>
              <template v-else>–</template>
            </span>
          </div>
        </div>
        <div class="job-card-footer">
          <Button
            label="Historie"
            icon="pi pi-history"
            severity="secondary"
            text
            size="small"
            @click="showHistory(job.id)"
          />
        </div>
      </div>
    </div>

    <Dialog
      v-model:visible="historyVisible"
      modal
      :header="`Historie: ${historyJobId}`"
      :style="{ width: '60rem' }"
      :breakpoints="{ '960px': '95vw' }"
    >
      <DataTable
        :value="historyItems"
        :loading="historyLoading"
        :lazy="true"
        :paginator="true"
        :rows="historyPageSize"
        :total-records="historyTotal"
        data-key="id"
        striped-rows
        scrollable
        @page="onHistoryPage"
      >
        <template #empty>Noch keine aufgezeichneten Läufe.</template>
        <Column field="started_at" header="Gestartet">
          <template #body="{ data }">
            {{ formatDateTime(data.started_at) }}
          </template>
        </Column>
        <Column field="duration_seconds" header="Dauer">
          <template #body="{ data }"> {{ data.duration_seconds.toFixed(1) }}s </template>
        </Column>
        <Column field="exit_code" header="Status">
          <template #body="{ data }">
            <Tag
              :value="data.exit_code === 0 ? 'OK' : 'FEHLER'"
              :severity="exitCodeSeverity(data.exit_code)"
            />
          </template>
        </Column>
        <Column field="output" header="Ausgabe">
          <template #body="{ data }">
            {{ data.output ?? '–' }}
          </template>
        </Column>
      </DataTable>
    </Dialog>
  </div>
</template>

<style scoped>
.scheduler-view {
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

.backup-action {
  display: flex;
  margin-bottom: 1.5rem;
}

.job-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.job-card {
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 10px;
  padding: 1.25rem;
  transition: box-shadow 0.15s;
}

.job-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.job-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.job-icon {
  color: var(--p-primary-color);
  font-size: 1.1rem;
}

.job-tag {
  font-size: 0.8rem;
  font-family: monospace;
}

.job-description {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

.job-details {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: var(--p-surface-50);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
}

.job-detail {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}

.job-detail-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.job-detail-value {
  font-size: 0.85rem;
  font-weight: 500;
  text-align: right;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.last-run-tag {
  font-size: 0.7rem;
}

.job-card-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

@media (min-width: 640px) {
  .job-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
