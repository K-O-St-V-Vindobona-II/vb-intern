<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import trackingService from '@/services/trackingService'
import { useTrackingRetention } from '@/composables/useTrackingRetention'
import type { SentEmailListItem, SentEmailDetail } from '@/types/tracking'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { formatApiError, formatDateTime } from '@/utils/formatters'
import { useToast } from 'primevue/usetoast'

const DEFAULT_PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300

type SentEmailQuery = Parameters<typeof trackingService.getSentEmails>[0]

const toast = useToast()

const items = ref<SentEmailListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)
const first = computed(() => (page.value - 1) * pageSize.value)
const loading = ref(false)

const search = ref('')
const selectedYear = ref<number | null>(null)
const selectedMonth = ref<number | null>(null)

const detailVisible = ref(false)
const selectedEmail = ref<SentEmailDetail | null>(null)

const { retentionMonths, months, loadRetention } = useTrackingRetention()

const yearOptions = computed(() => {
  const years = [...new Set(months.value.map((m) => m.year))]
  return years.map((y) => ({ label: String(y), value: y }))
})

const monthOptionsForYear = computed(() => {
  const base: { label: string; value: number | null }[] = [{ label: 'Alle Monate', value: null }]
  if (!selectedYear.value) return base
  return [
    ...base,
    ...months.value
      .filter((m) => m.year === selectedYear.value)
      .map((m) => ({ label: m.monthName, value: m.month })),
  ]
})

const buildQuery = (): SentEmailQuery => {
  const query: SentEmailQuery = { page: page.value, page_size: pageSize.value }
  if (selectedYear.value) query.year = selectedYear.value
  if (selectedMonth.value) query.month = selectedMonth.value
  const term = search.value.trim()
  if (term) query.search = term
  return query
}

// Answers arrive in any order: a slow answer for an earlier filter or page must
// not replace the rows of the current one.
let latestListRequestId = 0
let latestDetailRequestId = 0

const fetchData = async () => {
  const requestId = ++latestListRequestId
  loading.value = true
  try {
    const result = await trackingService.getSentEmails(buildQuery())
    if (requestId !== latestListRequestId) return
    items.value = result.items
    total.value = result.total
  } catch (e) {
    if (requestId !== latestListRequestId) return
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
  } finally {
    if (requestId === latestListRequestId) loading.value = false
  }
}

const showDetail = async (row: SentEmailListItem) => {
  const requestId = ++latestDetailRequestId
  try {
    const detail = await trackingService.getSentEmailDetail(row.id)
    if (requestId !== latestDetailRequestId) return
    selectedEmail.value = detail
    detailVisible.value = true
  } catch (e) {
    if (requestId !== latestDetailRequestId) return
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
  }
}

const onPage = (event: { page: number; rows: number }) => {
  page.value = event.page + 1
  pageSize.value = event.rows
  fetchData()
}

const reloadFromFirstPage = () => {
  page.value = 1
  fetchData()
}

// A month belongs to one year: switching the year must not keep filtering by a
// month the new selection no longer shows.
const onYearChange = () => {
  selectedMonth.value = null
}

watch([selectedYear, selectedMonth], reloadFromFirstPage)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(reloadFromFirstPage, SEARCH_DEBOUNCE_MS)
})

onBeforeUnmount(() => clearTimeout(searchTimer))

onMounted(async () => {
  await loadRetention()
  fetchData()
})
</script>

<template>
  <div>
    <h2>Versandte Emails</h2>
    <p class="retention-hint">
      <i class="pi pi-info-circle" />
      Es werden nur Daten der letzten {{ retentionMonths }} Monate angezeigt.
    </p>

    <div class="filter-bar">
      <Select
        v-model="selectedYear"
        :options="yearOptions"
        option-label="label"
        option-value="value"
        placeholder="Jahr"
        aria-label="Jahr"
        show-clear
        class="filter-select"
        @update:model-value="onYearChange"
      />
      <Select
        v-model="selectedMonth"
        :options="monthOptionsForYear"
        option-label="label"
        option-value="value"
        placeholder="Monat"
        aria-label="Monat"
        class="filter-select"
      />
      <InputText
        v-model="search"
        placeholder="Suche (Betreff, Empfänger)..."
        aria-label="Suche in Betreff und Empfänger"
        class="filter-search"
      />
    </div>

    <DataTable
      :value="items"
      :loading="loading"
      :lazy="true"
      :paginator="true"
      :rows="pageSize"
      :first="first"
      :total-records="total"
      :rows-per-page-options="[25, 50, 100]"
      data-key="id"
      striped-rows
      scrollable
      class="email-table"
      @page="onPage"
      @row-click="(e: { data: SentEmailListItem }) => showDetail(e.data)"
    >
      <Column field="created_at" header="Datum" class="col-date">
        <template #body="{ data }">
          {{ data.created_at ? formatDateTime(data.created_at) : '-' }}
        </template>
      </Column>
      <Column field="to" header="Empfänger" />
      <Column field="subject" header="Betreff" />
      <Column field="mailer" header="Mailer" class="col-mailer">
        <template #body="{ data }">
          <Tag :value="data.mailer" :severity="data.mailer === 'smtp' ? 'success' : 'info'" />
        </template>
      </Column>
      <Column header="" class="col-detail">
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
      :header="selectedEmail?.subject || 'Email-Detail'"
      :style="{ width: '60rem' }"
      :breakpoints="{ '960px': '95vw' }"
    >
      <div v-if="selectedEmail" class="email-detail">
        <div class="detail-meta">
          <div class="meta-row"><strong>Von:</strong> {{ selectedEmail.mail_from || '-' }}</div>
          <div class="meta-row"><strong>An:</strong> {{ selectedEmail.to || '-' }}</div>
          <div v-if="selectedEmail.cc" class="meta-row">
            <strong>CC:</strong> {{ selectedEmail.cc }}
          </div>
          <div v-if="selectedEmail.bcc" class="meta-row">
            <strong>BCC:</strong> {{ selectedEmail.bcc }}
          </div>
          <div class="meta-row">
            <strong>Datum:</strong>
            {{ selectedEmail.created_at ? formatDateTime(selectedEmail.created_at) : '-' }}
          </div>
          <div class="meta-row">
            <strong>Mailer:</strong>
            <Tag
              :value="selectedEmail.mailer"
              :severity="selectedEmail.mailer === 'smtp' ? 'success' : 'info'"
            />
          </div>
        </div>
        <div class="detail-body">
          <iframe
            v-if="selectedEmail.body"
            :srcdoc="selectedEmail.body"
            class="email-body-frame"
            sandbox=""
          />
          <p v-else>(Kein Inhalt)</p>
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

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.filter-select {
  width: 8rem;
}

.filter-search {
  flex: 1;
  min-width: 12rem;
}

.email-table {
  cursor: pointer;
}

.col-date {
  width: 10rem;
}

.col-mailer {
  width: 6rem;
}

.col-detail {
  width: 4rem;
  text-align: center;
}

.email-detail .detail-meta {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--app-border-card);
  margin-bottom: 1rem;
}

.meta-row {
  font-size: 0.9rem;
}

.email-body-frame {
  width: 100%;
  min-height: 400px;
  border: 1px solid var(--app-border-card);
  border-radius: 8px;
}
</style>
