<script setup lang="ts">
import { ref, onMounted } from 'vue'
import trackingService from '@/services/trackingService'
import type { EmailTemplateStats } from '@/types/tracking'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { formatApiError, formatDateTime } from '@/utils/formatters'
import { useToast } from 'primevue/usetoast'

const toast = useToast()
const templates = ref<EmailTemplateStats[]>([])
const loading = ref(false)
const retentionMonths = ref(6)
const totalEmails = ref(0)

const previewVisible = ref(false)
const previewHtml = ref('')
const previewName = ref('')
const previewLoading = ref(false)

const fetchData = async () => {
  loading.value = true
  try {
    templates.value = await trackingService.getEmailTemplates()
    totalEmails.value = templates.value.reduce((sum, t) => sum + t.count, 0)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
  } finally {
    loading.value = false
  }
}

const openPreview = async (templateKey: string, templateName: string) => {
  previewLoading.value = true
  previewName.value = templateName
  previewVisible.value = true
  try {
    const result = await trackingService.getTemplatePreview(templateKey)
    previewHtml.value = result.html
  } catch (e) {
    previewHtml.value = ''
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
    previewVisible.value = false
  } finally {
    previewLoading.value = false
  }
}

onMounted(async () => {
  try {
    const config = await trackingService.getConfig()
    retentionMonths.value = config.retention_months
  } catch {
    /* fallback to default */
  }
  fetchData()
})
</script>

<template>
  <div>
    <h2>Email-Vorlagen</h2>
    <p class="retention-hint">
      <i class="pi pi-info-circle" />
      Es werden nur Daten der letzten {{ retentionMonths }} Monate angezeigt.
    </p>

    <div class="stats-bar">
      <div class="stat-card">
        <span class="stat-value">{{ templates.length }}</span>
        <span class="stat-label">Vorlagen</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ totalEmails.toLocaleString('de-AT') }}</span>
        <span class="stat-label">Emails gesamt</span>
      </div>
    </div>

    <DataTable
      :value="templates"
      :loading="loading"
      striped-rows
      sort-field="count"
      :sort-order="-1"
    >
      <Column field="template_name" header="Vorlage" sortable>
        <template #body="{ data }">
          <div>
            <span class="template-name">{{ data.template_name }}</span>
            <span class="template-source" :title="data.source_location">{{
              data.source_location
            }}</span>
          </div>
        </template>
      </Column>
      <Column field="count" header="Anzahl" sortable class="col-count">
        <template #body="{ data }">
          <Tag :value="String(data.count)" severity="info" />
        </template>
      </Column>
      <Column field="last_sent" header="Zuletzt versendet" sortable class="col-date">
        <template #body="{ data }">
          {{ data.last_sent ? formatDateTime(data.last_sent) : '-' }}
        </template>
      </Column>
      <Column header="" class="col-preview">
        <template #body="{ data }">
          <Button
            v-tooltip="'Vorschau'"
            icon="pi pi-eye"
            text
            size="small"
            @click="openPreview(data.template_key, data.template_name)"
          />
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="previewVisible"
      :header="`Vorschau: ${previewName}`"
      :modal="true"
      :style="{ width: '50rem', maxWidth: '95vw' }"
    >
      <div v-if="previewLoading" class="preview-loading">
        <i class="pi pi-spinner pi-spin" />
        Lade Vorschau...
      </div>
      <iframe v-else-if="previewHtml" :srcdoc="previewHtml" sandbox="" class="preview-frame" />
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

.stats-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 2rem;
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 12px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.template-name {
  display: block;
  font-weight: 600;
}

.template-source {
  display: block;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  font-family: monospace;
}

.col-count {
  width: 6rem;
  text-align: center;
}

.col-date {
  width: 12rem;
}

.col-preview {
  width: 4rem;
  text-align: center;
}

.preview-loading {
  text-align: center;
  padding: 2rem;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.preview-frame {
  width: 100%;
  min-height: 500px;
  border: 1px solid var(--p-surface-200);
  border-radius: 6px;
  background: #fff;
}
</style>
