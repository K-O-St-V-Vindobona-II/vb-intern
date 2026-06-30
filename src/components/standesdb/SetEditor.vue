<script setup lang="ts">
import { ref, computed } from 'vue'
import FuzzyDatePicker from './FuzzyDatePicker.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'

interface SetItem {
  id: number
  name: string
  group?: string | null
  order?: number
}

interface Entry {
  id: number
  name?: string
  group?: string | null
  order?: number
  presentationdate: string | null
  presentationdate_accuracy: number
}

const props = defineProps<{
  modelValue: Entry[]
  availableItems: SetItem[]
  title: string
  withGroup?: boolean
  withDate?: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Entry[]]
}>()

const dialogVisible = ref(false)
const editingEntry = ref<Entry | null>(null)
const formId = ref<number>(0)
const formDate = ref<string | null>(null)
const formAccuracy = ref(0)

const sorted = computed(() => [...props.modelValue].sort((a, b) => (a.id ?? 0) - (b.id ?? 0)))

const unused = computed(() =>
  props.availableItems.filter((item) => !props.modelValue.some((e) => e.id === item.id)),
)

const itemName = (id: number) => props.availableItems.find((i) => i.id === id)?.name ?? '?'

const itemGroup = (id: number) => props.availableItems.find((i) => i.id === id)?.group ?? ''

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

const fuzzyDisplay = (date: string | null, accuracy: number) => {
  if (!date || accuracy === 0) return 'unbekannt'
  const parts = date.split('-')
  const y = parts[0]
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
  const m = parseInt(parts[1] ?? '0')
  const d = parseInt(parts[2] ?? '0')
  switch (accuracy) {
    case 1:
      return y
    case 2:
      return `${months[m] ?? ''} ${y}`
    default:
      return `${d}. ${months[m] ?? ''} ${y}`
  }
}

const openAdd = () => {
  editingEntry.value = null
  formId.value = unused.value[0]?.id ?? 0
  const today = new Date().toISOString().split('T')[0] ?? ''
  formDate.value = today
  formAccuracy.value = props.withDate ? 3 : 0
  dialogVisible.value = true
}

const openEdit = (entry: Entry) => {
  editingEntry.value = entry
  formId.value = entry.id
  formDate.value = entry.presentationdate
  formAccuracy.value = entry.presentationdate_accuracy
  dialogVisible.value = true
}

const save = () => {
  const updated = props.modelValue.filter((e) =>
    editingEntry.value ? e.id !== editingEntry.value.id : true,
  )
  updated.push({
    id: formId.value,
    name: itemName(formId.value),
    group: itemGroup(formId.value),
    presentationdate: formDate.value,
    presentationdate_accuracy: formAccuracy.value,
  })
  emit('update:modelValue', updated)
  dialogVisible.value = false
}

const remove = (entry: Entry) => {
  emit(
    'update:modelValue',
    props.modelValue.filter((e) => e.id !== entry.id),
  )
}

const selectOptions = computed(() => (editingEntry.value ? props.availableItems : unused.value))
</script>

<template>
  <div class="set-editor">
    <label class="set-label">{{ title }}</label>

    <DataTable :value="sorted" size="small" striped-rows class="set-table">
      <Column v-if="withGroup" header="Gruppe" style="width: 30%">
        <template #body="{ data }">
          {{ capitalize(itemGroup(data.id)) }}
        </template>
      </Column>
      <Column header="Name" style="min-width: 120px">
        <template #body="{ data }">
          {{ capitalize(itemName(data.id)) }}
        </template>
      </Column>
      <Column v-if="withDate" header="Datum" style="min-width: 100px">
        <template #body="{ data }">
          {{ fuzzyDisplay(data.presentationdate, data.presentationdate_accuracy) }}
        </template>
      </Column>
      <Column v-if="!readonly" style="width: 80px" class="text-center">
        <template #header>
          <Button
            v-if="unused.length"
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
      :header="editingEntry ? 'Bearbeiten' : 'Hinzufügen'"
      modal
      :style="{ width: '400px' }"
      :breakpoints="{ '600px': '95vw' }"
    >
      <div class="dialog-fields">
        <div class="field">
          <label>Name</label>
          <Select
            v-model="formId"
            :options="selectOptions"
            option-label="name"
            option-value="id"
            :disabled="!!editingEntry"
            class="w-full"
          />
        </div>

        <FuzzyDatePicker
          v-if="withDate"
          label="Überreichungsdatum"
          :date="formDate"
          :accuracy="formAccuracy"
          @update:date="formDate = $event"
          @update:accuracy="formAccuracy = $event"
        />
      </div>

      <template #footer>
        <Button label="Abbrechen" severity="secondary" @click="dialogVisible = false" />
        <Button label="Ok" @click="save" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.set-editor {
  margin-top: 1.75rem;
}

.set-label {
  display: block;
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.75rem;
  color: var(--p-text-color);
}

.set-table {
  font-size: 0.875rem;
}

.dialog-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-fields .field label {
  display: block;
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.w-full {
  width: 100%;
}
</style>
