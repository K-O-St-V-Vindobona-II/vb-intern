<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { RoleRef } from '@/types/standesdb'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Checkbox from 'primevue/checkbox'

interface RoleEntry {
  id: string
  label?: string | null
  group?: string | null
  startdate: string
  enddate: string | null
}

const props = defineProps<{
  modelValue: RoleEntry[]
  roles: RoleRef[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: RoleEntry[]]
}>()

const dialogVisible = ref(false)
const editingIndex = ref<number | null>(null)
const formRoleId = ref('')
const formStartdate = ref<Date>(new Date())
const formEnddate = ref<Date>(new Date())
const ongoing = ref(false)
const quickSemester = ref('SS')
const quickYear = ref(new Date().getFullYear())

const yearOptions = Array.from({ length: 2100 - 1929 }, (_, i) => 1929 + i)

const groupedRoles = computed(() => {
  const groups: Record<string, { label: string; value: string }[]> = {}
  const sorted = [...props.roles].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  for (const r of sorted) {
    const g = r.group ?? 'sonstige'
    if (!groups[g]) groups[g] = []
    groups[g].push({
      label: r.label ?? r.id,
      value: r.id,
    })
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
})

const sorted = computed(() =>
  [...props.modelValue].sort((a, b) => (a.startdate ?? '').localeCompare(b.startdate ?? '')),
)

const roleName = (id: string) => props.roles.find((r) => r.id === id)?.label ?? id

const roleGroup = (id: string) => props.roles.find((r) => r.id === id)?.group ?? ''

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

const formatDate = (d: string | null) => {
  if (!d) return null
  const parts = d.split('-')
  const months = [
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
  const [yr = '', mo = '', dy = ''] = parts
  return `${parseInt(dy)}. ${months[parseInt(mo)] ?? ''} ${yr}`
}

const toSql = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const fromSql = (s: string) => {
  const [y = 0, m = 1, d = 1] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const initDefaults = () => {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const isSS = month >= 2 && month <= 7
  if (isSS) {
    formStartdate.value = new Date(year, 1, 1)
    formEnddate.value = new Date(year, 6, 31)
    quickSemester.value = 'SS'
  } else {
    formStartdate.value = new Date(year, 7, 1)
    formEnddate.value = new Date(year + 1, 0, 31)
    quickSemester.value = 'WS'
  }
  quickYear.value = year
  ongoing.value = false
  formRoleId.value = props.roles[0]?.id ?? ''
}

const openAdd = () => {
  editingIndex.value = null
  initDefaults()
  dialogVisible.value = true
}

const openEdit = (idx: number) => {
  const entry = sorted.value[idx]
  if (!entry) return
  const realIdx = props.modelValue.findIndex(
    (e) => e.id === entry.id && e.startdate === entry.startdate,
  )
  editingIndex.value = realIdx
  formRoleId.value = entry.id
  formStartdate.value = fromSql(entry.startdate)
  if (entry.enddate) {
    formEnddate.value = fromSql(entry.enddate)
    ongoing.value = false
  } else {
    formEnddate.value = new Date()
    ongoing.value = true
  }
  dialogVisible.value = true
}

const save = () => {
  const newEntry: RoleEntry = {
    id: formRoleId.value,
    label: roleName(formRoleId.value),
    group: roleGroup(formRoleId.value),
    startdate: toSql(formStartdate.value),
    enddate: ongoing.value ? null : toSql(formEnddate.value),
  }

  const updated = [...props.modelValue]
  if (editingIndex.value !== null) {
    updated.splice(editingIndex.value, 1, newEntry)
  } else {
    updated.push(newEntry)
  }
  emit('update:modelValue', updated)
  dialogVisible.value = false
}

const remove = (idx: number) => {
  const entry = sorted.value[idx]
  if (!entry) return
  const realIdx = props.modelValue.findIndex(
    (e) => e.id === entry.id && e.startdate === entry.startdate,
  )
  if (realIdx >= 0) {
    const updated = [...props.modelValue]
    updated.splice(realIdx, 1)
    emit('update:modelValue', updated)
  }
}

watch(ongoing, (val) => {
  if (!val) {
    formEnddate.value = new Date()
  }
})

watch([quickSemester, quickYear], ([sem, year]) => {
  ongoing.value = false
  if (sem === 'WS') {
    formStartdate.value = new Date(year, 7, 1)
    formEnddate.value = new Date(year + 1, 0, 31)
  } else {
    formStartdate.value = new Date(year, 1, 1)
    formEnddate.value = new Date(year, 6, 31)
  }
})
</script>

<template>
  <div class="roles-editor">
    <label class="set-label"> Chargen, Funktionen, Kommissionen </label>

    <DataTable :value="sorted" size="small" striped-rows scrollable class="roles-table">
      <Column header="von" style="min-width: 130px">
        <template #body="{ data }">
          {{ formatDate(data.startdate) }}
        </template>
      </Column>
      <Column header="bis" style="min-width: 130px">
        <template #body="{ data }">
          <span v-if="data.enddate">
            {{ formatDate(data.enddate) }}
          </span>
          <span v-else style="color: var(--p-green-500); font-weight: 600"> laufend </span>
        </template>
      </Column>
      <Column header="Gruppe">
        <template #body="{ data }">
          {{ capitalize(roleGroup(data.id)) }}
        </template>
      </Column>
      <Column header="Rolle">
        <template #body="{ data }">
          {{ roleName(data.id) }}
        </template>
      </Column>
      <Column v-if="!readonly" style="width: 80px" class="text-center">
        <template #header>
          <Button icon="pi pi-plus" text size="small" severity="success" @click="openAdd" />
        </template>
        <template #body="{ index }">
          <Button icon="pi pi-pencil" text size="small" @click="openEdit(index)" />
          <Button icon="pi pi-minus" text size="small" severity="danger" @click="remove(index)" />
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="dialogVisible"
      :header="editingIndex !== null ? 'Bearbeiten' : 'Hinzufügen'"
      modal
      :style="{ width: '420px' }"
      :breakpoints="{ '600px': '95vw' }"
    >
      <div class="dialog-fields">
        <div class="field">
          <label>Rolle</label>
          <Select
            v-model="formRoleId"
            :options="groupedRoles"
            option-label="label"
            option-value="value"
            option-group-label="label"
            option-group-children="items"
            class="w-full"
          />
        </div>

        <div class="field">
          <label>von</label>
          <DatePicker
            v-model="formStartdate"
            :manual-input="false"
            date-format="dd. MM yy"
            show-icon
            class="w-full"
          />
        </div>

        <div v-if="!ongoing" class="field">
          <label>bis</label>
          <DatePicker
            v-model="formEnddate"
            :manual-input="false"
            date-format="dd. MM yy"
            show-icon
            class="w-full"
          />
        </div>

        <div class="field">
          <label>
            <Checkbox v-model="ongoing" :binary="true" />
            laufend
          </label>
        </div>

        <div class="quick-section">
          <label class="quick-label"> Schnellauswahl </label>
          <div class="quick-row">
            <Select
              v-model="quickSemester"
              :options="[
                { label: 'WS', value: 'WS' },
                { label: 'SS', value: 'SS' },
              ]"
              option-label="label"
              option-value="value"
              class="quick-select"
            />
            <Select v-model="quickYear" :options="yearOptions" class="quick-select" />
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Abbrechen" severity="secondary" @click="dialogVisible = false" />
        <Button label="Ok" @click="save" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.roles-editor {
  margin-top: 1.75rem;
}

.set-label {
  display: block;
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.75rem;
  color: var(--p-text-color);
}

.roles-table {
  font-size: 0.875rem;
}

.dialog-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dialog-fields .field label {
  display: block;
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.quick-section {
  border-top: 1px solid var(--p-surface-200);
  padding-top: 0.75rem;
}

.quick-label {
  display: block;
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.quick-row {
  display: flex;
  gap: 0.5rem;
}

.quick-select {
  flex: 1;
}

.w-full {
  width: 100%;
}
</style>
