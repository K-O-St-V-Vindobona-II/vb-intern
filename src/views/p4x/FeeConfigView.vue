<script setup lang="ts">
import { formatApiError } from '@/utils/formatters'
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import p4xService from '@/services/p4xService'
import type { P4xFee } from '@/types/p4x'
import Amount from './components/Amount.vue'
import FormAmount from './components/FormAmount.vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Message from 'primevue/message'

const toast = useToast()
const confirm = useConfirm()
const loading = ref(true)
const loadFailed = ref(false)
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
  loadFailed.value = false
  try {
    const resp = await p4xService.getFeeConfig()
    fees.value = resp.data
  } catch {
    loadFailed.value = true
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

const deleteFee = (fee: P4xFee) => {
  confirm.require({
    message: `Beitragseintrag "${formatMonth(fee.start)}" wirklich entfernen?`,
    header: 'Eintrag entfernen',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Abbrechen', severity: 'secondary' },
    acceptProps: { label: 'Entfernen', severity: 'danger' },
    accept: async () => {
      try {
        const resp = await p4xService.deleteFee(fee.start)
        fees.value = resp.data
        toast.add({ severity: 'success', summary: 'Eintrag entfernt', life: 2000 })
      } catch (e: unknown) {
        const msg = formatApiError(e)
        toast.add({ severity: 'error', summary: msg, life: 4000 })
      }
    },
  })
}

onMounted(load)
</script>

<template>
  <div v-if="loadFailed" class="load-error">
    <Message severity="error" :closable="false"
      >Die Beitragskonfiguration konnte nicht geladen werden.</Message
    >
    <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="load" />
  </div>
  <div v-else-if="!loading" class="fee-config">
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
          <Button
            v-else
            v-tooltip="'löschen'"
            icon="pi pi-trash"
            text
            rounded
            size="small"
            severity="danger"
            aria-label="löschen"
            @click="deleteFee(fee)"
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
        <Button label="Speichern" @click="save" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

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
  border-bottom: 1px solid var(--app-border-card);
}
.delete-col {
  width: 2rem;
  text-align: right;
}
.disabled-icon {
  color: var(--p-text-muted-color);
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
