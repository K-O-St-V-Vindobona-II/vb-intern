<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { formatApiError } from '@/utils/formatters'
import { siteSettingsService, programmHintsService } from '@/services/publicContentService'
import type { ProgrammHintResponse } from '@/services/publicContentService'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'

const toast = useToast()

const loading = ref(true)
const savingSettings = ref(false)

// about_video_heading/youtube_url/gallery_heading belong to the Video and
// Galerie admin views, but all live in the same settings resource on the
// backend - fetched here and resent unchanged on save so we never
// accidentally clear them.
const videoHeading = ref('')
const videoYoutubeUrl = ref('')
const calendarId = ref('')
const galleryHeading = ref('')

const hints = ref<ProgrammHintResponse[]>([])

const newHintText = ref('')
const addingHint = ref(false)

const editDialogVisible = ref(false)
const editHintId = ref(0)
const editHintText = ref('')

const deleteDialogVisible = ref(false)
const deleteHintId = ref(0)

const loadAll = async () => {
  loading.value = true
  try {
    const [settingsResp, hintsResp] = await Promise.all([
      siteSettingsService.getSettings(),
      programmHintsService.list(),
    ])
    videoHeading.value = settingsResp.data.about_video_heading
    videoYoutubeUrl.value = `https://www.youtube.com/watch?v=${settingsResp.data.about_video_youtube_id}`
    calendarId.value = settingsResp.data.programm_calendar_id
    galleryHeading.value = settingsResp.data.gallery_heading
    hints.value = hintsResp.data
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Programm-Daten konnten nicht geladen werden.'),
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}

const saveCalendar = async () => {
  savingSettings.value = true
  try {
    const resp = await siteSettingsService.updateSettings({
      about_video_heading: videoHeading.value,
      youtube_url: videoYoutubeUrl.value,
      calendar_id: calendarId.value,
      gallery_heading: galleryHeading.value,
    })
    calendarId.value = resp.data.programm_calendar_id
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Kalender-Link wurde gespeichert.',
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
    savingSettings.value = false
  }
}

const addHint = async () => {
  if (!newHintText.value.trim()) return
  addingHint.value = true
  try {
    await programmHintsService.create({ text: newHintText.value })
    newHintText.value = ''
    const resp = await programmHintsService.list()
    hints.value = resp.data
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Hinweis hinzugefügt.',
      life: 3000,
    })
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Hinzufügen fehlgeschlagen.'),
      life: 5000,
    })
  } finally {
    addingHint.value = false
  }
}

const moveHint = async (hint: ProgrammHintResponse, direction: 'up' | 'down') => {
  try {
    await programmHintsService.move(hint.id, direction)
    const resp = await programmHintsService.list()
    hints.value = resp.data
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Verschieben fehlgeschlagen.'),
      life: 5000,
    })
  }
}

const openEdit = (hint: ProgrammHintResponse) => {
  editHintId.value = hint.id
  editHintText.value = hint.text
  editDialogVisible.value = true
}

const saveEdit = async () => {
  try {
    await programmHintsService.update(editHintId.value, { text: editHintText.value })
    editDialogVisible.value = false
    const resp = await programmHintsService.list()
    hints.value = resp.data
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Änderungen gespeichert.',
      life: 3000,
    })
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Speichern fehlgeschlagen.'),
      life: 5000,
    })
  }
}

const confirmDelete = (hint: ProgrammHintResponse) => {
  deleteHintId.value = hint.id
  deleteDialogVisible.value = true
}

const doDelete = async () => {
  deleteDialogVisible.value = false
  try {
    await programmHintsService.remove(deleteHintId.value)
    hints.value = hints.value.filter((h) => h.id !== deleteHintId.value)
    toast.add({
      severity: 'success',
      summary: 'Gelöscht',
      detail: 'Hinweis entfernt.',
      life: 3000,
    })
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Löschen fehlgeschlagen.'),
      life: 5000,
    })
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="programm-admin">
    <template v-if="!loading">
      <div class="page-header">
        <h2 class="page-title">www-Administration</h2>
        <h3 class="page-subtitle">Programm</h3>
      </div>

      <div class="field">
        <label for="calendar-id">Google-Kalender</label>
        <InputText
          id="calendar-id"
          v-model="calendarId"
          class="w-full"
          placeholder="Kalender-ID oder Einbetten-Link"
        />
        <p class="field-hint">
          Zu finden in den Google-Kalender-Einstellungen unter "Kalender integrieren" — entweder die
          Kalender-ID direkt oder der ganze Einbetten-Link.
        </p>
      </div>
      <div class="actions">
        <Button
          label="Speichern"
          icon="pi pi-check"
          size="small"
          :loading="savingSettings"
          @click="saveCalendar"
        />
      </div>

      <div class="hints-section">
        <label class="section-label">Hinweise</label>

        <div class="add-row">
          <InputText
            v-model="newHintText"
            placeholder="Neuer Hinweis"
            maxlength="300"
            class="add-input"
            @keyup.enter="addHint"
          />
          <Button
            label="Hinzufügen"
            icon="pi pi-plus"
            size="small"
            :loading="addingHint"
            :disabled="!newHintText.trim()"
            @click="addHint"
          />
        </div>

        <div v-if="hints.length === 0" class="no-hints">Keine Hinweise vorhanden.</div>

        <div class="hint-list">
          <div v-for="(hint, index) in hints" :key="hint.id" class="hint-card">
            <span class="hint-icon" aria-hidden="true">✓</span>
            <span class="hint-text">{{ hint.text }}</span>
            <div class="hint-actions">
              <Button
                icon="pi pi-arrow-up"
                text
                size="small"
                :disabled="index === 0"
                aria-label="Nach oben verschieben"
                @click="moveHint(hint, 'up')"
              />
              <Button
                icon="pi pi-arrow-down"
                text
                size="small"
                :disabled="index === hints.length - 1"
                aria-label="Nach unten verschieben"
                @click="moveHint(hint, 'down')"
              />
              <Button
                icon="pi pi-pencil"
                text
                size="small"
                aria-label="Bearbeiten"
                @click="openEdit(hint)"
              />
              <Button
                icon="pi pi-trash"
                text
                size="small"
                severity="danger"
                aria-label="Löschen"
                @click="confirmDelete(hint)"
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog
        v-model:visible="editDialogVisible"
        header="Hinweis bearbeiten"
        modal
        :style="{ width: '420px' }"
        :breakpoints="{ '600px': '95vw' }"
      >
        <div class="field">
          <label for="edit-hint-text">Text</label>
          <InputText id="edit-hint-text" v-model="editHintText" maxlength="300" class="w-full" />
        </div>
        <template #footer>
          <Button label="Abbrechen" severity="secondary" @click="editDialogVisible = false" />
          <Button label="Speichern" @click="saveEdit" />
        </template>
      </Dialog>

      <Dialog
        v-model:visible="deleteDialogVisible"
        header="Hinweis löschen"
        modal
        :style="{ width: '400px' }"
        :breakpoints="{ '600px': '95vw' }"
      >
        <p>Soll dieser Hinweis wirklich gelöscht werden?</p>
        <template #footer>
          <Button label="Abbrechen" severity="secondary" @click="deleteDialogVisible = false" />
          <Button label="Löschen" severity="danger" icon="pi pi-trash" @click="doDelete" />
        </template>
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.programm-admin {
  max-width: 700px;
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

.field {
  margin-bottom: 1.25rem;
}

.field label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
}

.field-hint {
  margin: 0.35rem 0 0;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
}

.w-full {
  width: 100%;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 2rem;
}

.section-label {
  display: block;
  font-weight: 700;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.add-row {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.add-input {
  flex: 1;
}

.no-hints {
  text-align: center;
  color: var(--p-text-muted-color);
  padding: 1.5rem;
}

.hint-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint-card {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
  background: var(--p-surface-0);
}

.hint-icon {
  flex-shrink: 0;
  color: var(--p-primary-color);
  font-weight: 700;
}

.hint-text {
  flex: 1;
  font-size: 0.9rem;
}

.hint-actions {
  display: flex;
  gap: 0.1rem;
  flex-wrap: wrap;
}
</style>
