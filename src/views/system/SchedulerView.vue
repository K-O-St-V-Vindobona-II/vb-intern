<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import systemService from '@/services/systemService'
import type { ScheduledJobResponse } from '@/services/systemService'
import { formatApiError } from '@/utils/formatters'
import Tag from 'primevue/tag'
import Button from 'primevue/button'

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
        </div>
      </div>
    </div>
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
}

@media (min-width: 640px) {
  .job-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
