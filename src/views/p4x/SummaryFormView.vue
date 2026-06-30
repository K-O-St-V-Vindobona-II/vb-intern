<script setup lang="ts">
import { formatApiError } from '@/utils/formatters'
import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import p4xService from '@/services/p4xService'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'

const toast = useToast()
const ordering = ref(false)

const now = new Date()
const startDate = ref(new Date(now.getFullYear(), now.getMonth() - 12))
const endDate = ref(new Date(new Date().getFullYear(), new Date().getMonth() - 1))

const order = async () => {
  ordering.value = true
  try {
    const start = `${startDate.value.getFullYear()}-${String(startDate.value.getMonth() + 1).padStart(2, '0')}-01`
    const end = `${endDate.value.getFullYear()}-${String(endDate.value.getMonth() + 1).padStart(2, '0')}-01`

    const resp = await p4xService.orderSummary({ start, end })
    const blob = new Blob([resp.data], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Abrechnung_${start}_bis_${end}.zip`
    a.click()
    URL.revokeObjectURL(url)
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
        <label>Von (Monat)</label>
        <DatePicker
          v-model="startDate"
          :manual-input="false"
          view="month"
          date-format="MM yy"
          :max-date="new Date()"
        />
      </div>
      <div class="field">
        <label>Bis (Monat)</label>
        <DatePicker
          v-model="endDate"
          :manual-input="false"
          view="month"
          date-format="MM yy"
          :max-date="new Date()"
        />
      </div>
    </div>

    <div class="actions">
      <Button label="Auswertung bestellen" :loading="ordering" @click="order" />
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
