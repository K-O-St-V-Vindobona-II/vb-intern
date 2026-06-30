<script setup lang="ts">
import { formatApiError } from '@/utils/formatters'
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import p4xService from '@/services/p4xService'
import type { CategoryFilter, P4xCategory, FilterHit } from '@/types/p4x'
import CategoryLabel from './components/CategoryLabel.vue'
import Amount from './components/Amount.vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const filterId = Number(route.params.id)

const loading = ref(true)
const processing = ref(false)
const warningsCount = ref(0)
const filter = ref<CategoryFilter | null>(null)
const category = ref<P4xCategory | null>(null)
const hits = ref<FilterHit[]>([])

const formatDate = (d: string | null): string => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' })
}

const subjectModeLabel = (mode: string): string => {
  const labels: Record<string, string> = {
    equals: 'ist gleich',
    contains: 'enthält',
    starts: 'beginnt mit',
  }
  return labels[mode] ?? mode
}

onMounted(async () => {
  try {
    const resp = await p4xService.getFilter2DirectPreview(filterId)
    warningsCount.value = resp.data.warningsCount
    filter.value = resp.data.filter
    category.value = resp.data.category
    hits.value = resp.data.hits
  } finally {
    loading.value = false
  }
})

const process = async () => {
  processing.value = true
  try {
    const resp = await p4xService.processFilter2Direct(filterId)
    hits.value = resp.data.hits
    toast.add({ severity: 'success', summary: 'Konvertierung abgeschlossen', life: 3000 })
  } catch (e: unknown) {
    const msg = formatApiError(e)
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <div v-if="!loading" class="f2d-view">
    <div class="page-header">
      <h2>Kategorie-Filter</h2>
      <p class="subtitle">Treffer in Direktkategorisierung umwandeln</p>
    </div>

    <Card class="explain-card">
      <template #content>
        <p>
          Das grundsätzliche Ziel ist, dass alle Transaktionen <strong>direkt</strong> kategorisiert
          sind. Filter können helfen, eine Vorab-Kategorisierung vorzunehmen.
        </p>
        <p>
          Nach einer Prüfung (z.B. einer erfolgreichen Rechnungsprüfung oder nach Prüfung der unten
          angeführten Liste) können hier vorab-kategorisierte Transaktionen in eine
          Direkt-Kategorisierung umgewandelt werden.
        </p>
      </template>
    </Card>

    <div v-if="warningsCount > 0" class="warning-box">
      <i class="pi pi-exclamation-triangle" />
      Es gibt {{ warningsCount }} offene Warnungen. Konvertierung ist nicht möglich.
    </div>

    <Card v-if="filter" class="filter-card">
      <template #content>
        <div class="filter-details">
          <div class="detail-row">
            <span class="detail-label">Filtername:</span>
            <span>{{ filter.name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Konto:</span>
            <span>{{ filter.p4x_account_label }}</span>
          </div>
          <div v-if="filter.min_amount !== null" class="detail-row">
            <span class="detail-label">Minimalbetrag:</span>
            <Amount :amount="filter.min_amount" />
          </div>
          <div v-if="filter.max_amount !== null" class="detail-row">
            <span class="detail-label">Maximalbetrag:</span>
            <Amount :amount="filter.max_amount" />
          </div>
          <div v-if="filter.subject" class="detail-row">
            <span class="detail-label">Betreff {{ subjectModeLabel(filter.subject_mode) }}:</span>
            <code>{{ filter.subject }}</code>
          </div>
          <div v-if="filter.iban" class="detail-row">
            <span class="detail-label">IBAN:</span>
            <span>{{ filter.iban }}</span>
          </div>
          <div class="detail-row">
            <CategoryLabel v-if="category" :category="category" />
          </div>
        </div>
      </template>
    </Card>

    <div class="actions">
      <Button
        v-if="warningsCount === 0 && hits.length > 0"
        :label="`${hits.length} Filter-Treffer jetzt umwandeln.`"
        severity="danger"
        :loading="processing"
        @click="process"
      />
      <Button
        label="Zur Liste"
        severity="secondary"
        @click="router.push({ name: 'p4x-filters' })"
      />
    </div>

    <div v-if="hits.length" class="hits-section">
      <DataTable :value="hits" size="small" striped-rows scrollable>
        <Column header="" sortable style="width: 10rem">
          <template #body="{ data }">
            {{ formatDate(data.booking) }}
          </template>
        </Column>
        <Column field="iban" header="IBAN" sortable />
        <Column field="subject" header="Betreff" sortable />
        <Column header="amount" style="text-align: right; width: 8rem">
          <template #body="{ data }">
            <div style="text-align: right">
              <Amount :amount="data.amount" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <p v-else-if="!hits.length && !loading" class="empty">Keine Treffer vorhanden.</p>
  </div>
</template>

<style scoped>
.f2d-view {
  max-width: 1000px;
  margin: 0 auto;
}
.page-header {
  text-align: center;
  margin-bottom: 1.5rem;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0;
  font-size: 1.1rem;
}
.explain-card {
  margin-bottom: 1.5rem;
}
.explain-card p {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--p-text-muted-color);
}
.explain-card p:last-child {
  margin-bottom: 0;
}
.warning-box {
  background: var(--p-red-50);
  border: 1px solid var(--p-red-200);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  color: var(--p-red-700);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.filter-card {
  margin-bottom: 1.5rem;
}
.filter-details {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.detail-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.detail-label {
  font-weight: 600;
  white-space: nowrap;
}
.actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 1.5rem;
}
.hits-section {
  margin-top: 1rem;
}
.empty {
  text-align: center;
  color: var(--p-text-muted-color);
}
</style>
