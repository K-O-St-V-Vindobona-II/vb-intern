<script setup lang="ts">
import { ref, computed, useId } from 'vue'
import type { RoleRef } from '@/types/standesdb'
import { monthName } from '@/utils/formatters'
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

const fieldId = useId()
const roleFieldId = `${fieldId}-role`
const startFieldId = `${fieldId}-start`
const endFieldId = `${fieldId}-end`
const rangeHintId = `${fieldId}-range`

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
  const [yr = '', mo = '', dy = ''] = d.split('-')
  return `${parseInt(dy, 10)}. ${monthName(parseInt(mo, 10))} ${yr}`
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

// The table rows are the very objects of props.modelValue (sorted is a
// shallow copy), so the entry itself locates its position: matching on
// role and start date would pick the first of two entries that share both.
const openEdit = (entry: RoleEntry) => {
  editingIndex.value = props.modelValue.indexOf(entry)
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

// Same rule the API enforces on save (a role must start before it ends), so
// the mistake is reported while the dialog is still open.
const isRangeValid = computed(
  () => ongoing.value || toSql(formStartdate.value) < toSql(formEnddate.value),
)

const save = () => {
  if (!isRangeValid.value) return
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

const remove = (entry: RoleEntry) => {
  const realIdx = props.modelValue.indexOf(entry)
  if (realIdx < 0) return
  const updated = [...props.modelValue]
  updated.splice(realIdx, 1)
  emit('update:modelValue', updated)
}

// Both handlers are bound to user input only, deliberately not to watchers on
// the form state: a watcher also fires when openEdit()/initDefaults() set that
// state programmatically. Opening an entry with an end date right after an
// ongoing one would flip "ongoing" back to false, and the watcher would then
// replace the stored end date with today's date before the user sees it.
const onOngoingChange = (value: boolean) => {
  ongoing.value = value
  if (!value) {
    formEnddate.value = new Date()
  }
}

const applyQuickRange = () => {
  ongoing.value = false
  const year = quickYear.value
  if (quickSemester.value === 'WS') {
    formStartdate.value = new Date(year, 7, 1)
    formEnddate.value = new Date(year + 1, 0, 31)
  } else {
    formStartdate.value = new Date(year, 1, 1)
    formEnddate.value = new Date(year, 6, 31)
  }
}
</script>

<template>
  <div class="roles-editor">
    <span class="set-label"> Chargen, Funktionen, Kommissionen </span>

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
          <Button
            icon="pi pi-plus"
            text
            size="small"
            severity="success"
            aria-label="Hinzufügen"
            @click="openAdd"
          />
        </template>
        <template #body="{ data }">
          <Button
            icon="pi pi-pencil"
            text
            size="small"
            aria-label="Bearbeiten"
            @click="openEdit(data)"
          />
          <Button
            icon="pi pi-minus"
            text
            size="small"
            severity="danger"
            aria-label="Entfernen"
            @click="remove(data)"
          />
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
          <label :for="roleFieldId">Rolle</label>
          <Select
            v-model="formRoleId"
            :input-id="roleFieldId"
            :options="groupedRoles"
            option-label="label"
            option-value="value"
            option-group-label="label"
            option-group-children="items"
            class="w-full"
          />
        </div>

        <div class="field">
          <label :for="startFieldId">von</label>
          <DatePicker
            v-model="formStartdate"
            :input-id="startFieldId"
            :invalid="!isRangeValid"
            :manual-input="false"
            date-format="dd. MM yy"
            show-icon
            class="w-full"
          />
        </div>

        <div v-if="!ongoing" class="field">
          <label :for="endFieldId">bis</label>
          <DatePicker
            v-model="formEnddate"
            :input-id="endFieldId"
            :invalid="!isRangeValid"
            :aria-describedby="isRangeValid ? undefined : rangeHintId"
            :manual-input="false"
            date-format="dd. MM yy"
            show-icon
            class="w-full"
          />
          <small v-if="!isRangeValid" :id="rangeHintId" class="field-error" role="alert">
            Das Enddatum muss nach dem Startdatum liegen.
          </small>
        </div>

        <div class="field">
          <label>
            <Checkbox :model-value="ongoing" :binary="true" @update:model-value="onOngoingChange" />
            laufend
          </label>
        </div>

        <div class="quick-section">
          <span class="quick-label"> Schnellauswahl </span>
          <div class="quick-row">
            <Select
              v-model="quickSemester"
              aria-label="Semester"
              :options="[
                { label: 'WS', value: 'WS' },
                { label: 'SS', value: 'SS' },
              ]"
              option-label="label"
              option-value="value"
              class="quick-select"
              @update:model-value="applyQuickRange"
            />
            <Select
              v-model="quickYear"
              aria-label="Jahr"
              :options="yearOptions"
              class="quick-select"
              @update:model-value="applyQuickRange"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Abbrechen" severity="secondary" @click="dialogVisible = false" />
        <Button label="Ok" :disabled="!isRangeValid" @click="save" />
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

.field-error {
  display: block;
  margin-top: 0.25rem;
  color: var(--p-red-500);
}

.quick-section {
  border-top: 1px solid var(--app-border-card);
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
