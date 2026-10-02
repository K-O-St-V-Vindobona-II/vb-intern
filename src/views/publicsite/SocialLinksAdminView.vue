<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { formatApiError } from '@/utils/formatters'
import { socialLinksService } from '@/services/publicContentService'
import type { SocialLinkAdminResponse } from '@/services/publicContentService'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'

// Same rule as the API: a lower-case slug that starts with a letter.
const PLATFORM_SLUG = /^[a-z][a-z0-9_]*$/

const toast = useToast()

const loading = ref(true)
const loadError = ref(false)
const moving = ref(false)
const links = ref<SocialLinkAdminResponse[]>([])

const newPlatform = ref('')
const newLabel = ref('')
const newUrl = ref('')
const adding = ref(false)
const newPlatformSlug = computed(() => newPlatform.value.trim().toLowerCase())
const platformInvalid = computed(
  () => newPlatformSlug.value !== '' && !PLATFORM_SLUG.test(newPlatformSlug.value),
)
const canAdd = computed(
  () =>
    PLATFORM_SLUG.test(newPlatformSlug.value) &&
    newLabel.value.trim() !== '' &&
    newUrl.value.trim() !== '',
)

const editDialogVisible = ref(false)
const editLinkId = ref('')
const editLabel = ref('')
const editUrl = ref('')
const editIsEnabled = ref(true)
const canSaveEdit = computed(() => editLabel.value.trim() !== '' && editUrl.value.trim() !== '')

const deleteDialogVisible = ref(false)
const deleteLinkId = ref('')

const errorToast = (err: unknown, fallback: string) =>
  toast.add({
    severity: 'error',
    summary: 'Fehler',
    detail: formatApiError(err, fallback),
    life: 5000,
  })

// First load and retry: the page is replaced by the spinner while it runs.
const loadLinks = async () => {
  loading.value = true
  loadError.value = false
  try {
    const resp = await socialLinksService.list()
    links.value = resp.data
  } catch (err: unknown) {
    loadError.value = true
    errorToast(err, 'Social-Media-Links konnten nicht geladen werden.')
  } finally {
    loading.value = false
  }
}

// After a change only the list is read again, so the page keeps its scroll
// position and no failed read is mistaken for an empty list.
const refreshLinks = async () => {
  try {
    const resp = await socialLinksService.list()
    links.value = resp.data
  } catch (err: unknown) {
    errorToast(err, 'Social-Media-Links konnten nicht aktualisiert werden.')
  }
}

const addLink = async () => {
  if (!canAdd.value) return
  adding.value = true
  try {
    await socialLinksService.create({
      platform: newPlatformSlug.value,
      label: newLabel.value.trim(),
      url: newUrl.value.trim(),
      is_enabled: true,
    })
    newPlatform.value = ''
    newLabel.value = ''
    newUrl.value = ''
    await refreshLinks()
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Link hinzugefügt.',
      life: 3000,
    })
  } catch (err: unknown) {
    errorToast(err, 'Hinzufügen fehlgeschlagen.')
  } finally {
    adding.value = false
  }
}

const moveLink = async (link: SocialLinkAdminResponse, direction: 'up' | 'down') => {
  moving.value = true
  try {
    await socialLinksService.move(link.id, direction)
    await refreshLinks()
  } catch (err: unknown) {
    errorToast(err, 'Verschieben fehlgeschlagen.')
  } finally {
    moving.value = false
  }
}

const openEdit = (link: SocialLinkAdminResponse) => {
  editLinkId.value = link.id
  editLabel.value = link.label
  editUrl.value = link.url
  editIsEnabled.value = link.is_enabled
  editDialogVisible.value = true
}

const saveEdit = async () => {
  try {
    await socialLinksService.update(editLinkId.value, {
      label: editLabel.value.trim(),
      url: editUrl.value.trim(),
      is_enabled: editIsEnabled.value,
    })
    editDialogVisible.value = false
    await refreshLinks()
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Änderungen gespeichert.',
      life: 3000,
    })
  } catch (err: unknown) {
    errorToast(err, 'Speichern fehlgeschlagen.')
  }
}

const confirmDelete = (link: SocialLinkAdminResponse) => {
  deleteLinkId.value = link.id
  deleteDialogVisible.value = true
}

const doDelete = async () => {
  deleteDialogVisible.value = false
  try {
    await socialLinksService.remove(deleteLinkId.value)
    links.value = links.value.filter((l) => l.id !== deleteLinkId.value)
    toast.add({
      severity: 'success',
      summary: 'Gelöscht',
      detail: 'Link entfernt.',
      life: 3000,
    })
  } catch (err: unknown) {
    errorToast(err, 'Löschen fehlgeschlagen.')
  }
}

onMounted(loadLinks)
</script>

<template>
  <div class="social-links-admin">
    <div v-if="loadError" class="load-error">
      <p>Social-Media-Links konnten nicht geladen werden.</p>
      <Button label="Erneut versuchen" icon="pi pi-refresh" @click="loadLinks" />
    </div>
    <template v-else-if="!loading">
      <div class="page-header">
        <h2 class="page-title">www-Administration</h2>
        <h3 class="page-subtitle">Social Media Verweise</h3>
      </div>

      <div class="add-section">
        <label class="section-label">Neuer Verweis</label>
        <div class="add-row">
          <InputText
            v-model="newPlatform"
            placeholder="Kennung (z. B. linkedin)"
            aria-label="Kennung des neuen Verweises"
            :invalid="platformInvalid"
            maxlength="40"
            class="add-platform"
          />
          <InputText
            v-model="newLabel"
            placeholder="Anzeigename"
            aria-label="Anzeigename des neuen Verweises"
            maxlength="60"
            class="add-label"
          />
          <InputText
            v-model="newUrl"
            placeholder="https://…"
            aria-label="Adresse des neuen Verweises"
            maxlength="500"
            class="add-url"
          />
          <Button
            label="Hinzufügen"
            icon="pi pi-plus"
            size="small"
            :loading="adding"
            :disabled="!canAdd"
            @click="addLink"
          />
        </div>
        <p class="field-hint">
          Die Kennung wird intern verwendet und kann nach dem Anlegen nicht mehr geändert werden.
          Erlaubt sind Kleinbuchstaben, Ziffern und Unterstrich, beginnend mit einem Buchstaben.
        </p>
      </div>

      <div v-if="links.length === 0" class="no-links">Keine Social-Media-Links vorhanden.</div>

      <div class="link-list">
        <div v-for="(link, index) in links" :key="link.id" class="link-card">
          <div class="link-info">
            <div class="link-meta">
              <Tag :value="link.platform" severity="secondary" class="link-tag" />
              <Tag
                :value="link.is_enabled ? 'Aktiv' : 'Deaktiviert'"
                :severity="link.is_enabled ? 'success' : 'warn'"
              />
            </div>
            <p class="link-label">{{ link.label }}</p>
            <p class="link-url">{{ link.url }}</p>
          </div>
          <div class="link-actions">
            <Button
              icon="pi pi-arrow-up"
              text
              size="small"
              :disabled="index === 0 || moving"
              :aria-label="`Nach oben verschieben: ${link.label}`"
              @click="moveLink(link, 'up')"
            />
            <Button
              icon="pi pi-arrow-down"
              text
              size="small"
              :disabled="index === links.length - 1 || moving"
              :aria-label="`Nach unten verschieben: ${link.label}`"
              @click="moveLink(link, 'down')"
            />
            <Button
              label="Bearbeiten"
              icon="pi pi-pencil"
              text
              size="small"
              :aria-label="`Bearbeiten: ${link.label}`"
              @click="openEdit(link)"
            />
            <Button
              label="Löschen"
              icon="pi pi-trash"
              text
              size="small"
              severity="danger"
              :aria-label="`Löschen: ${link.label}`"
              @click="confirmDelete(link)"
            />
          </div>
        </div>
      </div>

      <Dialog
        v-model:visible="editDialogVisible"
        header="Social-Media-Link bearbeiten"
        modal
        :style="{ width: '460px' }"
        :breakpoints="{ '600px': '95vw' }"
      >
        <div class="dialog-fields">
          <div class="field">
            <label for="edit-link-label">Anzeigename</label>
            <InputText id="edit-link-label" v-model="editLabel" maxlength="60" class="w-full" />
          </div>
          <div class="field">
            <label for="edit-link-url">URL</label>
            <InputText id="edit-link-url" v-model="editUrl" maxlength="500" class="w-full" />
          </div>
          <div class="field">
            <label for="edit-link-enabled">
              <Checkbox v-model="editIsEnabled" input-id="edit-link-enabled" :binary="true" />
              Auf der öffentlichen Seite anzeigen
            </label>
          </div>
        </div>
        <template #footer>
          <Button label="Abbrechen" severity="secondary" @click="editDialogVisible = false" />
          <Button label="Speichern" :disabled="!canSaveEdit" @click="saveEdit" />
        </template>
      </Dialog>

      <Dialog
        v-model:visible="deleteDialogVisible"
        header="Social-Media-Link löschen"
        modal
        :style="{ width: '400px' }"
        :breakpoints="{ '600px': '95vw' }"
      >
        <p>Soll dieser Link wirklich gelöscht werden?</p>
        <template #footer>
          <Button label="Abbrechen" severity="secondary" @click="deleteDialogVisible = false" />
          <Button label="Löschen" severity="danger" icon="pi pi-trash" @click="doDelete" />
        </template>
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.social-links-admin {
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

.load-error {
  text-align: center;
  color: var(--p-text-muted-color);
  margin: 3rem 0;
}

.section-label {
  display: block;
  font-weight: 700;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.add-section {
  border: 1px solid var(--app-border-card);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  background: var(--app-surface-card);
}

.add-row {
  display: flex;
  gap: 0.75rem;
  flex-direction: column;
  align-items: stretch;
}

.add-platform {
  flex: 1;
  min-width: 140px;
}

.add-label {
  flex: 1;
  min-width: 140px;
}

.add-url {
  flex: 2;
}

.field-hint {
  margin: 0.6rem 0 0;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
}

.no-links {
  text-align: center;
  color: var(--p-text-muted-color);
  padding: 2rem;
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.link-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid var(--app-border-card);
  border-radius: 8px;
  padding: 0.9rem;
  background: var(--app-surface-card);
}

.link-info {
  flex: 1;
}

.link-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.4rem;
}

.link-tag {
  font-family: monospace;
}

.link-label {
  margin: 0 0 0.2rem;
  font-weight: 700;
}

.link-url {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  word-break: break-all;
}

.link-actions {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.dialog-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-fields .field label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
}

.w-full {
  width: 100%;
}

@media (min-width: 700px) {
  .add-row {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }
}
</style>
