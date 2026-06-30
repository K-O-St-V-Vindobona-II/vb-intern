<script setup lang="ts">
import { formatApiError } from '@/utils/formatters'
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'primevue/usetoast'
import standesdbService from '@/services/standesdbService'
import type { StandesdbImage } from '@/types/standesdb'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const ownerType = computed(() => (String(route.name).includes('member') ? 'member' : 'contact'))
const ownerId = computed(() => Number(route.params.id))
const backRoute = computed(() =>
  ownerType.value === 'member'
    ? { name: 'standesdb-member-show', params: { id: ownerId.value } }
    : { name: 'standesdb-contact-show', params: { id: ownerId.value } },
)

const loading = ref(true)
const uploading = ref(false)
const ownerCn = ref('')
const ownerOrgId = ref('')
const images = ref<StandesdbImage[]>([])
const imageUrls = ref<Record<number, string>>({})

const uploadFile = ref<File | null>(null)
const uploadDescription = ref('')

const editDialogVisible = ref(false)
const editImageId = ref(0)
const editDescription = ref<string | null>(null)
const editDefault = ref(false)

const deleteDialogVisible = ref(false)
const deleteImageId = ref(0)

const isAdmin = computed(() => {
  const perms = authStore.user?.permissions ?? []
  if (ownerType.value === 'contact') {
    return perms.includes('standesdbContactAdmin')
  }
  const orgPerm = `standesdb${ownerOrgId.value.charAt(0).toUpperCase() + ownerOrgId.value.slice(1)}Admin`
  return perms.includes(orgPerm)
})

const loadGallery = async () => {
  loading.value = true
  try {
    const resp =
      ownerType.value === 'member'
        ? await standesdbService.getMemberImages(ownerId.value)
        : await standesdbService.getContactImages(ownerId.value)
    ownerCn.value = resp.data.owner.cn ?? ''
    ownerOrgId.value = resp.data.owner.org_id ?? ''
    images.value = resp.data.images
    await loadPreviews()
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404 || status === 403) {
      router.replace({ name: 'not-found' })
      return
    }
  } finally {
    loading.value = false
  }
}

const loadPreviews = async () => {
  imageUrls.value = {}
  for (const img of images.value) {
    try {
      const resp = await standesdbService.getImageUrl(ownerType.value, ownerId.value, img.id, true)
      imageUrls.value[img.id] = resp.data.url
    } catch {
      /* ignore */
    }
  }
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return '–'
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
  if (file.size > 5 * 1024 * 1024) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: 'Datei zu groß (max. 5 MB).',
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
    await standesdbService.uploadImage(
      ownerType.value,
      ownerId.value,
      uploadFile.value,
      uploadDescription.value || null,
    )
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Profilbild gespeichert.',
      life: 3000,
    })
    uploadFile.value = null
    uploadDescription.value = ''
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

const openEdit = (img: StandesdbImage) => {
  editImageId.value = img.id
  editDescription.value = img.description
  editDefault.value = img.default === 1
  editDialogVisible.value = true
}

const saveEdit = async () => {
  try {
    await standesdbService.updateImage(ownerType.value, ownerId.value, editImageId.value, {
      description: editDescription.value,
      default: editDefault.value,
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

const confirmDelete = (img: StandesdbImage) => {
  deleteImageId.value = img.id
  deleteDialogVisible.value = true
}

const doDelete = async () => {
  deleteDialogVisible.value = false
  try {
    await standesdbService.deleteImage(ownerType.value, ownerId.value, deleteImageId.value)
    toast.add({
      severity: 'success',
      summary: 'Gelöscht',
      detail: 'Profilbild gelöscht.',
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

const doDownload = async (img: StandesdbImage) => {
  try {
    const resp = await standesdbService.getImageUrl(ownerType.value, ownerId.value, img.id)
    const a = document.createElement('a')
    a.href = resp.data.url
    a.download = `${ownerType.value}_${ownerId.value}_${img.id}.${img.type?.split('/')[1] ?? 'jpg'}`
    a.click()
  } catch {
    /* ignore */
  }
}

onMounted(loadGallery)
</script>

<template>
  <div class="image-gallery">
    <template v-if="!loading">
      <div class="page-header">
        <h2 class="page-title">Standesdatenbank</h2>
        <h3 class="page-subtitle">Profilbilder</h3>
        <p class="page-name">
          {{ ownerCn }}
        </p>
        <div class="header-actions">
          <Button
            label="Zurück"
            icon="pi pi-arrow-left"
            severity="info"
            size="small"
            @click="router.push(backRoute)"
          />
        </div>
      </div>

      <p class="image-count">{{ images.length }} Profilbild{{ images.length !== 1 ? 'er' : '' }}</p>

      <!-- Upload -->
      <div v-if="isAdmin" class="upload-section">
        <label class="section-label">Neues Bild hochladen</label>
        <div class="upload-row">
          <input
            type="file"
            accept="image/jpeg,image/png"
            class="upload-file-input"
            @change="onFileSelect"
          />
          <InputText
            v-model="uploadDescription"
            placeholder="Beschreibung (optional, max. 100 Zeichen)"
            maxlength="100"
            class="upload-desc"
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

      <!-- Gallery -->
      <div v-if="images.length === 0" class="no-images">Keine Profilbilder vorhanden.</div>

      <div class="image-list">
        <div v-for="img in images" :key="img.id" class="image-card">
          <img
            v-if="imageUrls[img.id]"
            :src="imageUrls[img.id]"
            alt="Profilbild"
            class="image-preview"
          />
          <div v-else class="image-placeholder">
            <i class="pi pi-image" style="font-size: 2rem; color: var(--p-surface-400)" />
          </div>

          <div class="image-info">
            <div class="image-meta">
              <span v-if="img.width && img.height">{{ img.width }} × {{ img.height }} px</span>
              <span v-if="img.size">{{ formatSize(img.size) }}</span>
              <Tag v-if="img.default === 1" value="Standard" severity="success" />
            </div>
            <div class="image-desc">
              {{ img.description || 'Keine Beschreibung' }}
            </div>
            <div class="image-actions">
              <Button
                label="Download"
                icon="pi pi-download"
                text
                size="small"
                @click="doDownload(img)"
              />
              <template v-if="isAdmin">
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
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Dialog -->
      <Dialog
        v-model:visible="editDialogVisible"
        header="Bild bearbeiten"
        modal
        :style="{ width: '420px' }"
        :breakpoints="{ '600px': '95vw' }"
      >
        <div class="dialog-fields">
          <div class="field">
            <label>Beschreibung</label>
            <InputText v-model="editDescription" maxlength="100" class="w-full" />
          </div>
          <div class="field">
            <label>
              <Checkbox v-model="editDefault" :binary="true" />
              Als Standard-Profilbild setzen
            </label>
          </div>
        </div>
        <template #footer>
          <Button label="Abbrechen" severity="secondary" @click="editDialogVisible = false" />
          <Button label="Speichern" @click="saveEdit" />
        </template>
      </Dialog>

      <!-- Delete Confirmation Dialog -->
      <Dialog
        v-model:visible="deleteDialogVisible"
        header="Profilbild löschen"
        modal
        :style="{ width: '400px' }"
        :breakpoints="{ '600px': '95vw' }"
      >
        <p>Soll dieses Profilbild wirklich gelöscht werden?</p>
        <template #footer>
          <Button label="Abbrechen" severity="secondary" @click="deleteDialogVisible = false" />
          <Button label="Löschen" severity="danger" icon="pi pi-trash" @click="doDelete" />
        </template>
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.image-gallery {
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
  margin: 0.25rem 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.page-name {
  margin: 0 0 1rem;
  font-size: 0.95rem;
  color: var(--p-primary-color);
}

.header-actions {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
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

.upload-desc {
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
  align-items: center;
  gap: 1rem;
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  padding: 0.75rem;
  background: var(--p-surface-0);
  align-items: flex-start;
}

.image-preview {
  max-width: 150px;
  max-height: 200px;
  border-radius: 6px;
  border: 1px solid var(--p-surface-200);
  object-fit: contain;
}

.image-placeholder {
  width: 150px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--p-surface-50);
  border-radius: 6px;
}

.image-info {
  flex: 1;
  min-width: 0;
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
    align-items: flex-start;
  }
  .upload-row {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }
}
</style>
