<script setup lang="ts">
import { formatApiError, formatDateLong } from '@/utils/formatters'
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import p4xService from '@/services/p4xService'
import type { P4xAccount, ImportResult } from '@/types/p4x'
import Amount from './components/Amount.vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Message from 'primevue/message'

const route = useRoute()
const toast = useToast()
const accountId = String(route.params['accountId'])

const loading = ref(true)
const loadFailed = ref(false)
const importing = ref(false)
const account = ref<P4xAccount | null>(null)
const result = ref<ImportResult | null>(null)
const selectedFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const summaryLabels: Record<string, { label: string; highlight?: boolean }> = {
  giventotal: { label: 'Insgesamt hochgeladene Transaktionen' },
  existing: { label: 'Bereits existierende Transaktionen' },
  zero_skipped: { label: 'Ignorierte Transaktionen (0,00)' },
  new: { label: 'Neuimportierte Transaktionen', highlight: true },
  before_init_date: { label: 'Vor Initialdatum (ignoriert)' },
  existing_with_new_binding: { label: 'Neu zugeordnete Transaktionen' },
  error: { label: 'Fehlerhafte Einträge' },
}

const loadAccount = async () => {
  const resp = await p4xService.getDashboard()
  account.value = resp.data.accounts.find((a: P4xAccount) => a.id === accountId) ?? null
}

const load = async () => {
  loading.value = true
  loadFailed.value = false
  try {
    await loadAccount()
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
}

const refreshAccount = async () => {
  try {
    await loadAccount()
  } catch {
    toast.add({
      severity: 'warn',
      summary: 'Konto nicht aktualisiert',
      detail: 'Der Import war erfolgreich, die Kontodaten konnten aber nicht neu geladen werden.',
      life: 6000,
    })
  }
}

const doImport = async () => {
  if (!selectedFile.value) return
  importing.value = true
  result.value = null
  try {
    const resp = await p4xService.importTransactions(accountId, selectedFile.value)
    result.value = resp.data
    if (resp.data.given.parsed) {
      toast.add({ severity: 'success', summary: 'Import abgeschlossen', life: 3000 })
      await refreshAccount()
    } else {
      toast.add({
        severity: 'error',
        summary: resp.data.message ?? 'Fehler beim Parsen',
        life: 5000,
      })
    }
  } catch (e: unknown) {
    const msg = formatApiError(e, 'Importfehler')
    toast.add({ severity: 'error', summary: msg, life: 5000 })
  } finally {
    importing.value = false
    selectedFile.value = null
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}
</script>

<template>
  <div v-if="loadFailed" class="load-error">
    <Message severity="error" :closable="false">Die Daten konnten nicht geladen werden.</Message>
    <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="load" />
  </div>
  <div v-else-if="!loading" class="import-view">
    <div class="page-header">
      <h2>Konto</h2>
      <p class="subtitle">Transaktionen importieren</p>
    </div>

    <Card v-if="account" class="account-card">
      <template #content>
        <div class="account-details">
          <div class="detail-row">
            <span class="detail-label">IBAN:</span>
            <span>{{ account.iban }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">BIC:</span>
            <span>{{ account.bic }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Bezeichnung:</span>
            <span>{{ account.label }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Anzahl der Transaktionen:</span>
            <span>{{ account.transactions_count }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Letzte Transaktion:</span>
            <span>{{ formatDateLong(account.transactions_latest) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Kontostand:</span>
            <Amount :amount="account.balance" />
          </div>
        </div>
      </template>
    </Card>

    <Card v-if="result?.given.parsed && result.summary" class="result-card">
      <template #content>
        <div class="summary-list">
          <template v-for="(meta, key) in summaryLabels" :key="key">
            <div
              v-if="result.summary[key] !== undefined"
              class="summary-row"
              :class="{ 'summary-highlight': meta.highlight }"
            >
              <span>{{ meta.label }}:</span>
              <strong>{{ result.summary[key] }}</strong>
            </div>
          </template>
        </div>
      </template>
    </Card>

    <div v-if="result && !result.given.parsed" class="error-card">
      <Card>
        <template #content>
          <p class="error-msg">
            {{ result.message }}
          </p>
        </template>
      </Card>
    </div>

    <div class="upload-section">
      <label class="file-picker" for="import-file-input">
        <input
          id="import-file-input"
          ref="fileInputRef"
          type="file"
          accept=".json"
          class="visually-hidden-input"
          :disabled="importing"
          @change="onFileChange"
        />
        <i :class="['pi', selectedFile ? 'pi-file' : 'pi-cloud-upload', 'picker-icon']" />
        <span v-if="selectedFile" class="file-name">{{ selectedFile.name }}</span>
        <span v-else class="picker-label">JSON-Datei auswählen</span>
      </label>
      <Button
        label="Transaktionen importieren"
        icon="pi pi-upload"
        severity="primary"
        :loading="importing"
        :disabled="!selectedFile"
        class="upload-btn"
        @click="doImport"
      />
    </div>
  </div>
</template>

<style scoped>
.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.import-view {
  max-width: 700px;
  margin: 0 auto;
}
.page-header {
  text-align: center;
  margin-bottom: 1.5rem;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0;
}
.account-card {
  margin-bottom: 1.5rem;
}
.account-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.detail-row {
  display: flex;
  gap: 0.5rem;
}
.detail-label {
  font-weight: 600;
  white-space: nowrap;
}
.result-card {
  margin-bottom: 1.5rem;
}
.summary-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  max-width: 400px;
}
.summary-highlight {
  color: var(--p-primary-600);
}
.error-card {
  margin-bottom: 1.5rem;
}
.error-msg {
  color: var(--p-red-700);
  margin: 0;
}
.upload-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.visually-hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.file-picker {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1.5rem;
  border: 2px dashed var(--app-border-card);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--app-surface-subtle);
}
.file-picker:hover {
  border-color: var(--p-primary-400);
  background: var(--p-primary-50);
}
.file-picker:has(:focus-visible) {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}
.picker-icon {
  font-size: 1.3rem;
  color: var(--p-primary-500);
}
.picker-label {
  color: var(--p-text-muted-color);
}
.file-name {
  font-weight: 500;
}
.upload-btn {
  margin-top: 0.25rem;
}
</style>
