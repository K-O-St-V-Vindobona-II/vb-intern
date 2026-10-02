<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { formatApiError } from '@/utils/formatters'
import { aboutTabsService } from '@/services/publicContentService'
import type { AboutTabAdminResponse, AboutTabSlot } from '@/services/publicContentService'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import LinkInsertTextarea from '@/components/LinkInsertTextarea.vue'

// Same limit as the API.
const MAX_BODY_LENGTH = 6000

const toast = useToast()

const loading = ref(true)
const loadError = ref(false)
const savingSlot = ref<AboutTabSlot | null>(null)
const tabs = ref<AboutTabAdminResponse[]>([])

const isTabValid = (tab: AboutTabAdminResponse) =>
  tab.title.trim() !== '' && tab.body.trim() !== '' && tab.body.length <= MAX_BODY_LENGTH

const loadTabs = async () => {
  loading.value = true
  loadError.value = false
  try {
    const resp = await aboutTabsService.listTabs()
    tabs.value = resp.data
  } catch (err: unknown) {
    loadError.value = true
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Texte konnten nicht geladen werden.'),
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}

const saveTab = async (tab: AboutTabAdminResponse) => {
  savingSlot.value = tab.slot
  try {
    const resp = await aboutTabsService.updateTab(tab.slot, {
      title: tab.title.trim(),
      body: tab.body.trim(),
    })
    const index = tabs.value.findIndex((t) => t.slot === tab.slot)
    if (index !== -1) tabs.value[index] = resp.data
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: `"${resp.data.title}" wurde gespeichert.`,
      life: 3000,
    })
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Speichern fehlgeschlagen.'),
      life: 5000,
    })
  } finally {
    savingSlot.value = null
  }
}

onMounted(loadTabs)
</script>

<template>
  <div class="texts-admin">
    <div v-if="loadError" class="load-error">
      <p>Texte konnten nicht geladen werden.</p>
      <Button label="Erneut versuchen" icon="pi pi-refresh" @click="loadTabs" />
    </div>
    <template v-else-if="!loading">
      <div class="page-header">
        <h2 class="page-title">www-Administration</h2>
        <h3 class="page-subtitle">Texte</h3>
      </div>

      <div class="tab-list">
        <div v-for="tab in tabs" :key="tab.slot" class="tab-card">
          <div class="field">
            <label :for="`title-${tab.slot}`">Titel</label>
            <InputText
              :id="`title-${tab.slot}`"
              v-model="tab.title"
              maxlength="100"
              class="w-full"
            />
          </div>
          <div class="field">
            <label :for="`body-${tab.slot}`">Text</label>
            <LinkInsertTextarea
              :id="`body-${tab.slot}`"
              v-model="tab.body"
              :rows="8"
              placeholder="Fließtext. Leerzeile = neuer Absatz."
            />
            <small
              class="body-counter"
              :class="{ 'body-counter-over': tab.body.length > MAX_BODY_LENGTH }"
            >
              {{ tab.body.length }} / {{ MAX_BODY_LENGTH }}
            </small>
          </div>
          <div class="tab-actions">
            <Button
              label="Speichern"
              icon="pi pi-check"
              size="small"
              :loading="savingSlot === tab.slot"
              :disabled="!isTabValid(tab)"
              @click="saveTab(tab)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.texts-admin {
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.page-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.page-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
}

.page-subtitle {
  margin: 0.25rem 0 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.tab-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tab-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: 1px solid var(--app-border-card);
  border-radius: 8px;
  padding: 1.25rem;
  background: var(--app-surface-card);
}

.load-error {
  text-align: center;
  color: var(--p-text-muted-color);
  margin: 3rem 0;
}

.body-counter {
  display: block;
  text-align: right;
  margin-top: 0.25rem;
  color: var(--p-text-muted-color);
}

.body-counter-over {
  color: var(--p-red-500);
}

.field label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
}

.w-full {
  width: 100%;
}

.tab-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
