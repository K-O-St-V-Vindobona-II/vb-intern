<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import trackingService from '@/services/trackingService'
import type { SentEmailListItem, SentEmailDetail } from '@/types/tracking'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import { formatApiError, formatDateTime } from '@/utils/formatters'
import { useToast } from 'primevue/usetoast'

const toast = useToast()

const items = ref<SentEmailListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 25
const loading = ref(false)

const search = ref('')
const selectedYear = ref<number | null>(null)
const selectedMonth = ref<number | null>(null)

const detailVisible = ref(false)
const selectedEmail = ref<SentEmailDetail | null>(null)

const retentionMonths = ref(6)

const now = new Date()
const cutoffDate = computed(
  () => new Date(now.getFullYear(), now.getMonth() - retentionMonths.value, 1),
)

const allMonthNames = [
  '',
  'Jänner',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

const validMonths = computed(() => {
  const result: { year: number; month: number }[] = []
  const d = new Date(cutoffDate.value)
  while (d <= now) {
    result.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
    d.setMonth(d.getMonth() + 1)
  }
  return result
})

const yearOptions = computed(() => {
  const years = [...new Set(validMonths.value.map((m) => m.year))]
  return years.map((y) => ({ label: String(y), value: y }))
})

const monthOptionsForYear = computed(() => {
  const base: { label: string; value: number | null }[] = [{ label: 'Alle Monate', value: null }]
  if (!selectedYear.value) return base
  return [
    ...base,
    ...validMonths.value
      .filter((m) => m.year === selectedYear.value)
      .map((m) => ({ label: allMonthNames[m.month], value: m.month })),
  ]
})

const fetchData = async () => {
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      page: page.value,
      page_size: pageSize,
    }
    if (selectedYear.value) params['year'] = selectedYear.value
    if (selectedMonth.value) params['month'] = selectedMonth.value
    if (search.value.trim()) params['search'] = search.value.trim()

    const result = await trackingService.getSentEmails(params)
    items.value = result.items
    total.value = result.total
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
  } finally {
    loading.value = false
  }
}

const showDetail = async (row: SentEmailListItem) => {
  try {
    selectedEmail.value = await trackingService.getSentEmailDetail(row.id)
    detailVisible.value = true
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
  }
}

const onPage = (event: { page: number }) => {
  page.value = event.page + 1
  fetchData()
}

watch([selectedYear, selectedMonth, search], () => {
  page.value = 1
  fetchData()
})

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
        class="filter-select"
      />
      <Select
        v-model="selectedMonth"
        :options="monthOptionsForYear"
        option-label="label"
        option-value="value"
        placeholder="Monat"
        class="filter-select"
      />
      <InputText
        v-model="search"
        placeholder="Suche (Betreff, Empfänger)..."
        class="filter-search"
      />
    </div>

    <DataTable
      :value="items"
      :loading="loading"
      :lazy="true"
      :paginator="true"
      :rows="pageSize"
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

.email-detail .detail-meta {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--p-surface-200);
  margin-bottom: 1rem;
}

.meta-row {
  font-size: 0.9rem;
}

.email-body-frame {
  width: 100%;
  min-height: 400px;
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
}
</style>
