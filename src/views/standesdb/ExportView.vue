<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import standesdbService from '@/services/standesdbService'
import type { ExportConfig, StateRef } from '@/types/standesdb'
import Card from 'primevue/card'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const toast = useToast()

const loading = ref(true)
const exporting = ref(false)
const config = ref<ExportConfig | null>(null)

const selectedModule = ref('')
const matrixState = ref<Record<string, boolean>>({})
const flags = ref({
  include_disabled_delivery: false,
  include_dead: false,
  include_common_contacts: false,
  only_without_email: false,
})

const initMatrix = () => {
  if (!config.value) return
  const m: Record<string, boolean> = {}
  for (const org of config.value.orgs) {
    for (const state of config.value.states) {
      m[`${org.id}_${state.id}`] = false
    }
    m[`${org.id}_contacts`] = false
  }
  matrixState.value = m
}

const toggleOrg = (orgId: string) => {
  if (!config.value) return
  const keys = config.value.states.map((s) => `${orgId}_${s.id}`)
  const allOn = keys.every((k) => matrixState.value[k])
  for (const k of keys) {
    matrixState.value[k] = !allOn
  }
}

const toggleState = (stateId: string) => {
  if (!config.value) return
  const keys = config.value.orgs.map((o) => `${o.id}_${stateId}`)
  const allOn = keys.every((k) => matrixState.value[k])
  for (const k of keys) {
    matrixState.value[k] = !allOn
  }
}

const toggleContacts = () => {
  if (!config.value) return
  const keys = config.value.orgs.map((o) => `${o.id}_contacts`)
  const allOn = keys.every((k) => matrixState.value[k])
  for (const k of keys) {
    matrixState.value[k] = !allOn
  }
}

const matrixRows = () => {
  if (!config.value) return []
  const rows: { id: string; label: string; type: 'state' | 'contacts' }[] = config.value.states.map(
    (s: StateRef) => ({
      id: s.id,
      label: s.label,
      type: 'state' as const,
    }),
  )
  rows.push({
    id: 'contacts',
    label: 'Kontakte',
    type: 'contacts',
  })
  return rows
}

const getMatrixKey = (orgId: string, row: { id: string; type: string }) => {
  return row.type === 'contacts' ? `${orgId}_contacts` : `${orgId}_${row.id}`
}

const doExport = async () => {
  exporting.value = true
  try {
    const payload: Record<string, unknown> = {
      module: selectedModule.value,
      ...matrixState.value,
      ...flags.value,
    }
    const resp = await standesdbService.downloadExport(payload)

    const disposition = resp.headers['content-disposition'] ?? ''
    const match = disposition.match(/filename=(.+)/)
    const filename = match ? match[1] : `export_${new Date().toISOString().slice(0, 10)}`

    const url = URL.createObjectURL(resp.data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    toast.add({
      severity: 'success',
      summary: 'Export erstellt',
      detail: `${filename} wurde heruntergeladen.`,
      life: 3000,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: 'Export fehlgeschlagen.',
      life: 5000,
    })
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  try {
    const resp = await standesdbService.getExportConfig()
    config.value = resp.data
    selectedModule.value = resp.data.modules[0]?.id ?? ''
    initMatrix()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="export-page">
    <div class="export-header">
      <h2>Standesdatenbank</h2>
      <p class="export-subtitle">Export</p>
    </div>

    <template v-if="!loading && config">
      <!-- Schritt 1: Modul -->
      <Card class="export-card">
        <template #title>
          <div class="step-title">
            <span class="step-badge">1</span>
            Export-Format
          </div>
        </template>
        <template #content>
          <Select
            v-model="selectedModule"
            :options="config.modules"
            option-label="label"
            option-value="id"
            class="module-select"
          />
        </template>
      </Card>

      <!-- Schritt 2: Datenauswahl -->
      <Card class="export-card">
        <template #title>
          <div class="step-title">
            <span class="step-badge">2</span>
            Daten auswählen
          </div>
        </template>
        <template #content>
          <div class="presets">
            <span class="presets-label">Schnellauswahl:</span>
            <div class="preset-buttons">
              <Button
                type="button"
                label="VBW"
                size="small"
                severity="secondary"
                outlined
                @click="toggleOrg('vbw')"
              />
              <Button
                type="button"
                label="VBN"
                size="small"
                severity="secondary"
                outlined
                @click="toggleOrg('vbn')"
              />
              <Button
                type="button"
                label="Kontakte"
                size="small"
                severity="secondary"
                outlined
                @click="toggleContacts"
              />
            </div>
          </div>

          <DataTable :value="matrixRows()" striped-rows size="small" class="matrix-table">
            <Column header="" style="width: 40%">
              <template #body="{ data: row }">
                <a
                  v-if="row.type === 'state'"
                  class="matrix-link"
                  @click.prevent="toggleState(row.id)"
                >
                  {{ row.label }}
                </a>
                <a v-else class="matrix-link" @click.prevent="toggleContacts">
                  {{ row.label }}
                </a>
              </template>
            </Column>
            <Column v-for="org in config.orgs" :key="org.id" style="width: 30%; text-align: center">
              <template #header>
                {{ org.label }}
              </template>
              <template #body="{ data: row }">
                <div class="matrix-cell">
                  <Checkbox v-model="matrixState[getMatrixKey(org.id, row)]" :binary="true" />
                </div>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <!-- Schritt 3: Optionen -->
      <Card class="export-card">
        <template #title>
          <div class="step-title">
            <span class="step-badge">3</span>
            Optionen
          </div>
        </template>
        <template #content>
          <div class="flag-list">
            <label class="flag-item">
              <Checkbox v-model="flags.include_disabled_delivery" :binary="true" />
              <div>
                <span>Einträge mit deaktivierter Zustellung einbeziehen</span>
                <small class="flag-hint">
                  Bei verstorbenen Mitgliedern wird die Zustellung ebenfalls deaktiviert!
                </small>
              </div>
            </label>

            <label class="flag-item">
              <Checkbox v-model="flags.include_dead" :binary="true" />
              <span>Verstorbene Mitglieder einbeziehen</span>
            </label>

            <label class="flag-item">
              <Checkbox v-model="flags.include_common_contacts" :binary="true" />
              <span>Allgemeine Kontakte einbeziehen</span>
            </label>

            <label class="flag-item">
              <Checkbox v-model="flags.only_without_email" :binary="true" />
              <span>Nur Einträge ohne E-Mail einbeziehen</span>
            </label>
          </div>
        </template>
      </Card>

      <!-- Export-Button -->
      <div class="export-action">
        <Button
          label="Export starten"
          icon="pi pi-download"
          severity="primary"
          size="large"
          :loading="exporting"
          @click="doExport"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.export-page {
  max-width: 800px;
  margin: 0 auto;
}

.export-header {
  margin-bottom: 1rem;
}

.export-subtitle {
  color: var(--p-text-muted-color);
  margin: 0;
}

.export-card {
  margin-bottom: 1rem;
}

.step-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  border-radius: 50%;
  background: var(--p-primary-color);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
}

.module-select {
  width: 100%;
  max-width: 400px;
}

.presets {
  margin-bottom: 1rem;
}

.presets-label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
  color: var(--p-text-muted-color);
}

.preset-buttons {
  display: flex;
  gap: 0.5rem;
  flex-direction: column;
}

.matrix-table {
  margin-top: 0.5rem;
}

.matrix-table :deep(th),
.matrix-table :deep(td) {
  text-align: center;
}

.matrix-cell {
  display: flex;
  justify-content: center;
}

.matrix-link {
  color: var(--p-primary-color);
  cursor: pointer;
  font-weight: 600;
  text-decoration: none;
}

.matrix-link:hover {
  text-decoration: underline;
}

.flag-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.flag-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  cursor: pointer;
}

.flag-hint {
  display: block;
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
  margin-top: 0.15rem;
}

.export-action {
  text-align: center;
  margin: 1.5rem 0 2rem;
}

@media (min-width: 600px) {
  .preset-buttons {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
