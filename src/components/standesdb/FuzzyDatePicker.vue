<script setup lang="ts">
import { ref, computed, watch, useId } from 'vue'
import { MONTH_NAMES, monthName } from '@/utils/formatters'
import Checkbox from 'primevue/checkbox'
import Select from 'primevue/select'
import Popover from 'primevue/popover'

const props = defineProps<{
  date: string | null
  accuracy: number
  label: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:date': [value: string | null]
  'update:accuracy': [value: number]
}>()

const popover = ref<InstanceType<typeof Popover> | null>(null)
const inputId = `${useId()}-value`

const parseDate = (d: string | null) => {
  if (!d) return { year: 2000, month: 1, day: 1 }
  const [y = '', m = '', dy = ''] = d.split('-')
  return {
    year: parseInt(y, 10) || 2000,
    month: parseInt(m, 10) || 1,
    day: parseInt(dy, 10) || 1,
  }
}

const parsed = parseDate(props.date)
const year = ref(parsed.year)
const month = ref(parsed.month)
const day = ref(parsed.day)

watch(
  () => props.date,
  (val) => {
    const p = parseDate(val)
    year.value = p.year
    month.value = p.month
    day.value = p.day
  },
)

const yearOptions = Array.from({ length: 2200 - 1850 }, (_, i) => 1850 + i)

const monthOptions = MONTH_NAMES.map((label, i) => ({ value: i + 1, label }))

const daysInMonth = computed(() => new Date(year.value, month.value, 0).getDate())

const dayOptions = computed(() => Array.from({ length: daysInMonth.value }, (_, i) => i + 1))

const emitDate = () => {
  const d = Math.min(day.value, daysInMonth.value)
  day.value = d
  const pad = (n: number) => n.toString().padStart(2, '0')
  emit('update:date', `${year.value}-${pad(month.value)}-${pad(d)}`)
}

const setAccuracy = (checked: boolean, unit: 'year' | 'month' | 'day') => {
  let acc = props.accuracy
  switch (unit) {
    case 'year':
      acc = checked ? 1 : 0
      break
    case 'month':
      acc = checked ? 2 : 1
      break
    case 'day':
      acc = checked ? 3 : 2
      break
  }
  emit('update:accuracy', acc)
  if (acc > 0) emitDate()
}

const displayValue = computed(() => {
  if (!props.date || props.accuracy === 0) return 'unbekannt'
  const p = parseDate(props.date)
  switch (props.accuracy) {
    case 1:
      return `${p.year}`
    case 2:
      return `${monthName(p.month)} ${p.year}`
    default:
      return `${p.day}. ${monthName(p.month)} ${p.year}`
  }
})

const togglePopover = (event: Event) => {
  popover.value?.toggle(event)
}
</script>

<template>
  <div class="fuzzy-date-field">
    <label class="field-label" :for="inputId">{{ label }}</label>

    <input
      v-if="readonly"
      :id="inputId"
      type="text"
      :value="displayValue"
      readonly
      disabled
      class="p-inputtext p-component w-full"
    />

    <template v-else>
      <input
        :id="inputId"
        type="text"
        :value="displayValue"
        readonly
        aria-haspopup="dialog"
        class="p-inputtext p-component w-full fuzzy-trigger"
        @click="togglePopover"
        @keydown.enter.prevent="togglePopover"
        @keydown.space.prevent="togglePopover"
      />

      <Popover ref="popover" dismissable>
        <div class="fuzzy-popover">
          <div class="fuzzy-row">
            <Checkbox
              :model-value="accuracy > 0"
              :binary="true"
              aria-label="Jahr bekannt"
              @update:model-value="setAccuracy($event, 'year')"
            />
            <span v-if="accuracy === 0" class="fuzzy-hint"> Jahr bekannt </span>
            <Select
              v-else
              v-model="year"
              aria-label="Jahr"
              :options="yearOptions"
              class="fuzzy-select"
              @update:model-value="emitDate"
            />
          </div>

          <div v-if="accuracy >= 1" class="fuzzy-row">
            <Checkbox
              :model-value="accuracy > 1"
              :binary="true"
              aria-label="Monat bekannt"
              @update:model-value="setAccuracy($event, 'month')"
            />
            <span v-if="accuracy === 1" class="fuzzy-hint"> Monat bekannt </span>
            <Select
              v-else
              v-model="month"
              aria-label="Monat"
              :options="monthOptions"
              option-label="label"
              option-value="value"
              class="fuzzy-select"
              @update:model-value="emitDate"
            />
          </div>

          <div v-if="accuracy >= 2" class="fuzzy-row">
            <Checkbox
              :model-value="accuracy > 2"
              :binary="true"
              aria-label="Tag bekannt"
              @update:model-value="setAccuracy($event, 'day')"
            />
            <span v-if="accuracy === 2" class="fuzzy-hint"> Tag bekannt </span>
            <Select
              v-else
              v-model="day"
              aria-label="Tag"
              :options="dayOptions"
              class="fuzzy-select"
              @update:model-value="emitDate"
            />
          </div>
        </div>
      </Popover>
    </template>
  </div>
</template>

<style scoped>
.fuzzy-date-field {
  margin-bottom: 0.35rem;
}

.field-label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
  color: var(--p-text-color);
}

.fuzzy-trigger {
  cursor: pointer;
  background-color: var(--app-surface-card);
}

.fuzzy-popover {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.25rem;
  min-width: 200px;
}

.fuzzy-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.fuzzy-select {
  flex: 1;
  min-width: 130px;
}

.fuzzy-hint {
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
}

.w-full {
  width: 100%;
}
</style>
