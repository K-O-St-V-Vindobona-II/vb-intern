<script setup lang="ts">
import { formatApiError } from '@/utils/formatters'
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import p4xService from '@/services/p4xService'
import type { P4xFee } from '@/types/p4x'
import Amount from './components/Amount.vue'
import FormAmount from './components/FormAmount.vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'

const toast = useToast()
const loading = ref(true)
const fees = ref<P4xFee[]>([])
const dialogVisible = ref(false)

const now = new Date()
const newFee = ref({
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  fee: 0,
})
const selectedDate = ref(new Date(now.getFullYear(), now.getMonth()))

const formatMonth = (start: string): string => {
  const d = new Date(start)
  return `ab: ${d.toLocaleDateString('de-AT', { month: 'long', year: 'numeric' })}`
}

const load = async () => {
  loading.value = true
  try {
    const resp = await p4xService.getFeeConfig()
    fees.value = resp.data
  } finally {
    loading.value = false
  }
}

const onMonthChange = () => {
  newFee.value.year = selectedDate.value.getFullYear()
  newFee.value.month = selectedDate.value.getMonth() + 1
}

const save = async () => {
  try {
    const resp = await p4xService.createFee(newFee.value)
    fees.value = resp.data
    toast.add({ severity: 'success', summary: 'Eintrag hinzugefügt', life: 2000 })
    dialogVisible.value = false
  } catch (e: unknown) {
    const msg = formatApiError(e)
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  }
}

const deleteFee = async (start: string) => {
  try {
    const resp = await p4xService.deleteFee(start)
    fees.value = resp.data
    toast.add({ severity: 'success', summary: 'Eintrag entfernt', life: 2000 })
  } catch (e: unknown) {
    const msg = formatApiError(e)
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  }
}

onMounted(load)
</script>

<template>
  <div v-if="!loading" class="fee-config">
    <h2>Mitgliedsbeiträge</h2>
    <p class="subtitle">Beitragskonfiguration</p>

    <div class="fee-list">
      <div v-for="fee in fees" :key="fee.start" class="fee-row">
        <span>{{ formatMonth(fee.start) }}</span>
        <Amount :amount="fee.fee" />
        <span class="delete-col">
          <i
            v-if="fee.protected"
            v-tooltip="'Geschützte Einträge können nicht gelöscht werden.'"
            class="pi pi-trash disabled-icon"
          />
          <i
            v-else
            v-tooltip="'löschen'"
            class="pi pi-trash clickable"
            @click="deleteFee(fee.start)"
          />
        </span>
      </div>
    </div>

    <div class="actions-center">
      <Button label="hinzufügen" @click="dialogVisible = true" />
    </div>

    <Dialog
      v-model:visible="dialogVisible"
      header="Neuer Beitragseintrag"
      :modal="true"
      style="width: 20rem"
    >
      <div class="dialog-field">
        <label class="dialog-label">Startmonat</label>
        <DatePicker
          v-model="selectedDate"
          :manual-input="false"
          view="month"
          date-format="MM yy"
          @date-select="onMonthChange"
        />
      </div>
      <div class="dialog-field">
        <label class="dialog-label">Betrag</label>
        <FormAmount v-model="newFee.fee" />
      </div>
      <template #footer>
        <Button label="Abbrechen" severity="secondary" @click="dialogVisible = false" />
        <Button label="Speichern" severity="danger" @click="save" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.fee-config {
  max-width: 600px;
  margin: 0 auto;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0 0 1.5rem;
}
.fee-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--p-surface-200);
}
.delete-col {
  width: 2rem;
  text-align: right;
}
.clickable {
  cursor: pointer;
  color: var(--p-text-muted-color);
}
.clickable:hover {
  color: var(--p-red-600);
}
.disabled-icon {
  color: var(--p-surface-300);
}
.actions-center {
  text-align: center;
  margin-top: 2rem;
}
.dialog-field {
  margin-bottom: 1rem;
}
.dialog-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.3rem;
}
</style>
