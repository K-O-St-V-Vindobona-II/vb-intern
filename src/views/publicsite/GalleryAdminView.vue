<script setup lang="ts">
import { formatApiError } from '@/utils/formatters'
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import publicGalleryService from '@/services/publicGalleryService'
import type { GalleryImageAdminResponse } from '@/services/publicGalleryService'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'

const toast = useToast()

const loading = ref(true)
const uploading = ref(false)
const images = ref<GalleryImageAdminResponse[]>([])

const uploadFile = ref<File | null>(null)
const uploadCaption = ref('')

const editDialogVisible = ref(false)
const editImageId = ref('')
const editCaption = ref<string | null>(null)
const editIsPublished = ref(true)

const deleteDialogVisible = ref(false)
const deleteImageId = ref('')

const loadGallery = async () => {
  loading.value = true
  try {
    const resp = await publicGalleryService.listImages()
    images.value = resp.data
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Galerie konnte nicht geladen werden.'),
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const onFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const allowed = ['image/jpeg', 'image/png']
  if (!allowed.includes(file.type)) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: 'Nur JPEG- und PNG-Dateien erlaubt.',
      life: 5000,
    })
    input.value = ''
    return
  }
  if (file.size > 8 * 1024 * 1024) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: 'Datei zu groß (max. 8 MB).',
      life: 5000,
    })
    input.value = ''
    return
  }
  uploadFile.value = file
}

const doUpload = async () => {
  if (!uploadFile.value) return
  uploading.value = true
  try {
    await publicGalleryService.uploadImage(uploadFile.value, uploadCaption.value || null)
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Bild zur Galerie hinzugefügt.',
      life: 3000,
    })
    uploadFile.value = null
    uploadCaption.value = ''
    const fileInput = document.querySelector('.upload-file-input') as HTMLInputElement
    if (fileInput) fileInput.value = ''
    await loadGallery()
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Upload fehlgeschlagen.'),
      life: 5000,
    })
  } finally {
    uploading.value = false
  }
}

const doMove = async (img: GalleryImageAdminResponse, direction: 'up' | 'down') => {
  try {
    await publicGalleryService.moveImage(img.id, direction)
    await loadGallery()
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Verschieben fehlgeschlagen.'),
      life: 5000,
    })
  }
}

const openEdit = (img: GalleryImageAdminResponse) => {
  editImageId.value = img.id
  editCaption.value = img.caption
  editIsPublished.value = img.is_published
  editDialogVisible.value = true
}

const saveEdit = async () => {
  try {
    await publicGalleryService.updateImage(editImageId.value, {
      caption: editCaption.value,
      is_published: editIsPublished.value,
    })
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Änderungen gespeichert.',
      life: 3000,
    })
    editDialogVisible.value = false
    await loadGallery()
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Speichern fehlgeschlagen.'),
      life: 5000,
    })
  }
}

const confirmDelete = (img: GalleryImageAdminResponse) => {
  deleteImageId.value = img.id
  deleteDialogVisible.value = true
}

const doDelete = async () => {
  deleteDialogVisible.value = false
  try {
    await publicGalleryService.deleteImage(deleteImageId.value)
    toast.add({
      severity: 'success',
      summary: 'Gelöscht',
      detail: 'Bild aus der Galerie entfernt.',
      life: 3000,
    })
    await loadGallery()
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Löschen fehlgeschlagen.'),
      life: 5000,
    })
  }
}

onMounted(loadGallery)
</script>

<template>
  <div class="gallery-admin">
    <template v-if="!loading">
      <div class="page-header">
        <h2 class="page-title">www-Administration</h2>
        <h3 class="page-subtitle">Galerie</h3>
      </div>

      <p class="image-count">{{ images.length }} Bild{{ images.length !== 1 ? 'er' : '' }}</p>

      <div class="upload-section">
        <label class="section-label">Neues Bild hochladen</label>
        <div class="upload-row">
          <input
            type="file"
            accept="image/jpeg,image/png"
            class="upload-file-input"
            @change="onFileSelect"
          />
          <InputText
            v-model="uploadCaption"
            placeholder="Bildunterschrift (optional, max. 150 Zeichen)"
            maxlength="150"
            class="upload-caption"
          />
          <Button
            label="Hochladen"
            icon="pi pi-upload"
            size="small"
            :loading="uploading"
            :disabled="!uploadFile"
            @click="doUpload"
          />
        </div>
      </div>

      <div v-if="images.length === 0" class="no-images">Keine Bilder in der Galerie.</div>

      <div class="image-list">
        <div v-for="(img, index) in images" :key="img.id" class="image-card">
          <img :src="img.url" :alt="img.caption ?? 'Galeriebild'" class="image-preview" />

          <div class="image-info">
            <div class="image-meta">
              <span>{{ img.width }} × {{ img.height }} px</span>
              <span>{{ formatSize(img.size) }}</span>
              <Tag
                :value="img.is_published ? 'Veröffentlicht' : 'Entwurf'"
                :severity="img.is_published ? 'success' : 'warn'"
              />
            </div>
            <div class="image-desc">
              {{ img.caption || 'Keine Bildunterschrift' }}
            </div>
            <div class="image-actions">
              <Button
                icon="pi pi-arrow-up"
                text
                size="small"
                :disabled="index === 0"
                aria-label="Nach oben verschieben"
                @click="doMove(img, 'up')"
              />
              <Button
                icon="pi pi-arrow-down"
                text
                size="small"
                :disabled="index === images.length - 1"
                aria-label="Nach unten verschieben"
                @click="doMove(img, 'down')"
              />
              <Button
                label="Bearbeiten"
                icon="pi pi-pencil"
                text
                size="small"
                @click="openEdit(img)"
              />
              <Button
                label="Löschen"
                icon="pi pi-trash"
                text
                size="small"
                severity="danger"
                @click="confirmDelete(img)"
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog
        v-model:visible="editDialogVisible"
        header="Bild bearbeiten"
        modal
        :style="{ width: '420px' }"
        :breakpoints="{ '600px': '95vw' }"
      >
        <div class="dialog-fields">
          <div class="field">
            <label>Bildunterschrift</label>
            <InputText v-model="editCaption" maxlength="150" class="w-full" />
          </div>
          <div class="field">
            <label>
              <Checkbox v-model="editIsPublished" :binary="true" />
              Auf der öffentlichen Seite anzeigen
            </label>
          </div>
        </div>
        <template #footer>
          <Button label="Abbrechen" severity="secondary" @click="editDialogVisible = false" />
          <Button label="Speichern" @click="saveEdit" />
        </template>
      </Dialog>

      <Dialog
        v-model:visible="deleteDialogVisible"
        header="Bild löschen"
        modal
        :style="{ width: '400px' }"
        :breakpoints="{ '600px': '95vw' }"
      >
        <p>Soll dieses Bild wirklich aus der Galerie gelöscht werden?</p>
        <template #footer>
          <Button label="Abbrechen" severity="secondary" @click="deleteDialogVisible = false" />
          <Button label="Löschen" severity="danger" icon="pi pi-trash" @click="doDelete" />
        </template>
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.gallery-admin {
  max-width: 900px;
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

.image-count {
  text-align: center;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.section-label {
  display: block;
  font-weight: 700;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.upload-section {
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  background: var(--p-surface-0);
}

.upload-row {
  display: flex;
  gap: 0.75rem;
  flex-direction: column;
  align-items: stretch;
}

.upload-file-input {
  font-size: 0.85rem;
}

.upload-caption {
  flex: 1;
  min-width: 200px;
}

.no-images {
  text-align: center;
  color: var(--p-text-muted-color);
  padding: 2rem;
}

.image-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.image-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  padding: 0.75rem;
  background: var(--p-surface-0);
}

.image-preview {
  max-width: 150px;
  max-height: 200px;
  border-radius: 6px;
  border: 1px solid var(--p-surface-200);
  object-fit: contain;
}

.image-info {
  flex: 1;
  min-width: 0;
  width: 100%;
}

.image-meta {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.4rem;
  flex-wrap: wrap;
}

.image-desc {
  font-size: 0.9rem;
  color: var(--p-text-color);
  margin-bottom: 0.5rem;
}

.image-actions {
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

@media (min-width: 600px) {
  .image-card {
    flex-direction: row;
  }
  .upload-row {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }
}
</style>
