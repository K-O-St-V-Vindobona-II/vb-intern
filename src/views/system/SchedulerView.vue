<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useAuthStore } from '@/stores/auth'
import systemService from '@/services/systemService'
import type { ScheduledJobResponse, ScheduledJobRunListItem } from '@/services/systemService'
import { formatApiError, formatDateTime } from '@/utils/formatters'
import { appEnvironment } from '@/runtimeConfig'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const authStore = useAuthStore()
const loading = ref(true)
const jobs = ref<ScheduledJobResponse[]>([])
const backupLoading = ref(false)
const downsyncLoading = ref(false)

// Production is this app's leading data source - every other stage is
// meant to be refreshable from it on demand (Downsync), not backed up
// independently (a non-production backup has little value once Downsync
// exists). Backend still allows POST /backups/trigger everywhere (see its
// docstring) - this is a UI-only simplification, one relevant action per
// stage instead of two.
const isProduction = computed(() => appEnvironment() === 'production')

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

const triggerDownsync = async () => {
  downsyncLoading.value = true
  try {
    await systemService.triggerDownsync()
    toast.add({
      severity: 'success',
      summary: 'Downsync gestartet - Fortschritt in der Job-Historie unten sichtbar.',
      life: 5000,
    })
    // The restore step replaces this stage's entire database, including
    // the sessions table - every currently logged-in user (this one
    // included) gets logged out the moment that happens. Shown right
    // away, before the background task even starts mirroring S3, so
    // there's no race with the actual logout - sticky (no life) since
    // missing it means being logged out with no warning at all.
    toast.add({
      severity: 'error',
      summary: 'Achtung: automatische Abmeldung folgt',
      detail:
        'Der Downsync ersetzt in Kürze die komplette Datenbank dieser Stage, inklusive ' +
        'aller aktiven Sitzungen. Alle angemeldeten Personen auf dieser Stage (auch Du) ' +
        'werden dabei automatisch abgemeldet - bitte danach neu einloggen.',
    })
    // Log out right away instead of waiting for some future request to
    // fail with 401 once the restore actually runs - the session is
    // already doomed the moment it does, so there's no reason for the UI
    // to keep looking "logged in" in the meantime. Toast is rendered
    // outside <RouterView> (see App.vue), so both toasts above stay
    // visible across this navigation. authStore.logout() never throws
    // (it swallows its own backend-call failure internally) - safe here
    // even if the backend session is already half-gone.
    await authStore.logout()
    router.push({ name: 'login' })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: formatApiError(e, 'Downsync konnte nicht gestartet werden.'),
      life: 5000,
    })
  } finally {
    downsyncLoading.value = false
  }
}

// Guards the actual trigger behind an explicit confirmation - unlike the
// backup button, this replaces this stage's entire database and files and
// force-logs-out everyone on it, so a stray click must not be enough to
// set it off (same confirm.require() pattern already used for other
// irreversible actions, e.g. DirList.vue's delete/restore).
const confirmDownsync = () => {
  confirm.require({
    message:
      'Downsync ersetzt die komplette Datenbank und alle Dateien dieser Stage mit dem ' +
      'aktuellen Produktivstand. Alle angemeldeten Personen auf dieser Stage (auch Du) ' +
      'werden dabei automatisch abgemeldet. Fortfahren?',
    header: 'Downsync bestätigen',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: {
      label: 'Abbrechen',
      severity: 'secondary',
    },
    acceptProps: {
      label: 'Downsync starten',
      severity: 'danger',
    },
    accept: triggerDownsync,
  })
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

    <div v-if="isProduction" class="backup-action">
      <Button
        label="Backup jetzt erstellen"
        icon="pi pi-database"
        :loading="backupLoading"
        @click="triggerBackup"
      />
      <p class="action-hint action-hint-stage">
        Dieser Button steht nur in der Production-Stage zur Verfügung.
      </p>
      <p class="action-hint">
        Erstellt sofort ein zusätzliches Backup der Produktivdaten in S3 - unabhängig vom täglichen
        automatischen Backup.
      </p>
    </div>

    <div v-else class="backup-action">
      <Button
        label="Downsync jetzt durchführen"
        icon="pi pi-cloud-download"
        :loading="downsyncLoading"
        @click="confirmDownsync"
      />
      <p class="action-hint action-hint-stage">
        Dieser Button steht nur in nicht-produktiven Stages zur Verfügung.
      </p>
      <p class="action-hint">
        Lädt die aktuellen Produktivdaten (Dateien + Datenbank) auf diese Stage herunter und ersetzt
        hier alles damit. Production ist die führende Datenquelle - läuft im Hintergrund,
        Fortschritt und Ergebnis erscheinen unten in der Job-Historie.
      </p>
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
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.action-hint {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin: 0;
  max-width: 60ch;
}

.action-hint-stage {
  font-weight: 700;
  color: var(--p-red-500);
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
