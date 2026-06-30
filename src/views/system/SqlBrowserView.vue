<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import systemService from '@/services/systemService'
import type { TableColumn, TableDataResponse } from '@/services/systemService'
import { formatApiError } from '@/utils/formatters'
import { useToast } from 'primevue/usetoast'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Panel from 'primevue/panel'
import Tag from 'primevue/tag'

const toast = useToast()

const tables = ref<string[]>([])
const selectedTable = ref<string | null>(null)
const columns = ref<TableColumn[]>([])
const rows = ref<Record<string, string | null>[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 25
const loading = ref(false)

const fetchTables = async () => {
  try {
    const resp = await systemService.getTables()
    tables.value = resp.data
  } catch (e) {
    toast.add({ severity: 'error', summary: formatApiError(e), life: 5000 })
  }
}

const fetchData = async () => {
  if (!selectedTable.value) return
  loading.value = true
  try {
    const resp = await systemService.getTableData(selectedTable.value, {
      page: page.value,
      page_size: pageSize,
    })
    const data: TableDataResponse = resp.data
    columns.value = data.columns
    rows.value = data.rows
    total.value = data.total
  } catch (e) {
    toast.add({ severity: 'error', summary: formatApiError(e), life: 5000 })
  } finally {
    loading.value = false
  }
}

const onTableChange = () => {
  page.value = 1
  rows.value = []
  columns.value = []
  fetchData()
}

const onPage = (event: { page: number }) => {
  page.value = event.page + 1
  fetchData()
}

watch(selectedTable, onTableChange)
onMounted(fetchTables)
</script>

<template>
  <div class="sql-browser">
    <h2>SQL-Einsicht</h2>
    <p class="hint">Direkter Lesezugriff auf alle Datenbanktabellen.</p>

    <div class="table-select">
      <Select
        v-model="selectedTable"
        :options="tables"
        placeholder="Tabelle auswählen..."
        filter
        class="table-dropdown"
      />
      <span v-if="selectedTable" class="row-count">
        {{ total.toLocaleString('de-AT') }} Einträge
      </span>
    </div>

    <template v-if="selectedTable && columns.length">
      <Panel header="Tabellenstruktur" toggleable collapsed class="structure-panel">
        <DataTable :value="columns" striped-rows size="small">
          <Column field="name" header="Spalte" />
          <Column field="type" header="Typ" />
          <Column header="PK">
            <template #body="{ data }">
              <Tag v-if="data.primary_key" value="PK" severity="warn" />
            </template>
          </Column>
          <Column header="Nullable">
            <template #body="{ data }">
              <span :class="data.nullable ? 'nullable-yes' : 'nullable-no'">
                {{ data.nullable ? 'Ja' : 'Nein' }}
              </span>
            </template>
          </Column>
        </DataTable>
      </Panel>

      <DataTable
        :value="rows"
        :loading="loading"
        :lazy="true"
        :paginator="true"
        :rows="pageSize"
        :total-records="total"
        striped-rows
        size="small"
        scrollable
        class="data-table"
        @page="onPage"
      >
        <Column v-for="col in columns" :key="col.name" :field="col.name" :header="col.name">
          <template #body="{ data }">
            <span class="cell-value">{{ data[col.name] ?? '' }}</span>
          </template>
        </Column>
      </DataTable>
    </template>
  </div>
</template>

<style scoped>
.sql-browser {
  max-width: 100%;
}

.hint {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin: 0 0 1rem;
}

.table-select {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.table-dropdown {
  min-width: 100%;
}

.row-count {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.structure-panel {
  margin-bottom: 1rem;
}

.data-table {
  font-size: 0.8rem;
}

.cell-value {
  max-width: 20rem;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nullable-yes {
  color: var(--p-text-muted-color);
}

.nullable-no {
  font-weight: 600;
}

@media (min-width: 768px) {
  .table-dropdown {
    min-width: 20rem;
  }
}
</style>
