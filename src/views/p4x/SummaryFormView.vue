<script setup lang="ts">
import { formatApiError } from '@/utils/formatters'
import { downloadBlobResponse } from '@/utils/downloadBlob'
import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import p4xService from '@/services/p4xService'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import Message from 'primevue/message'

const toast = useToast()
const ordering = ref(false)

const today = new Date()
const startDate = ref(new Date(today.getFullYear(), today.getMonth() - 12))
const endDate = ref(new Date(today.getFullYear(), today.getMonth() - 1))

const rangeInvalid = computed(() => startDate.value > endDate.value)

const firstOfMonth = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`

const order = async () => {
  if (rangeInvalid.value) return
  ordering.value = true
  try {
    const start = firstOfMonth(startDate.value)
    const end = firstOfMonth(endDate.value)

    const resp = await p4xService.orderSummary({ start, end })
    downloadBlobResponse(resp, `Abrechnung_${start}_bis_${end}.zip`)
  } catch (e: unknown) {
    const msg = formatApiError(e)
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  } finally {
    ordering.value = false
  }
}
</script>

<template>
  <div class="summary-form">
    <h2>Auswertung</h2>
    <p class="subtitle">Abrechnung bestellen</p>

    <div class="form-grid">
      <div class="field">
        <label for="summary-start">Von (Monat)</label>
        <DatePicker
          v-model="startDate"
          input-id="summary-start"
          :manual-input="false"
          view="month"
          date-format="MM yy"
          :max-date="today"
        />
      </div>
      <div class="field">
        <label for="summary-end">Bis (Monat)</label>
        <DatePicker
          v-model="endDate"
          input-id="summary-end"
          :manual-input="false"
          view="month"
          date-format="MM yy"
          :max-date="today"
        />
      </div>
    </div>

    <Message v-if="rangeInvalid" severity="warn" :closable="false" class="range-hint">
      Das Startdatum darf nicht nach dem Enddatum liegen.
    </Message>

    <div class="actions">
      <Button
        label="Auswertung bestellen"
        :loading="ordering"
        :disabled="rangeInvalid"
        @click="order"
      />
    </div>

    <p class="hint">Die Auswertung wird als ZIP-Datei heruntergeladen (Excel + Anlagen).</p>
  </div>
</template>

<style scoped>
.summary-form {
  max-width: 500px;
  margin: 0 auto;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0 0 1.5rem;
}
.form-grid {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.field {
  flex: 1;
}
.field label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.3rem;
}
.range-hint {
  margin-bottom: 1.5rem;
}
.actions {
  text-align: center;
  margin-bottom: 1rem;
}
.hint {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  text-align: center;
}
</style>
