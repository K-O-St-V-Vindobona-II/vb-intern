<script setup lang="ts">
import { formatApiError, formatSize, getApiErrorStatus, trimmedOrNull } from '@/utils/formatters'
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'primevue/usetoast'
import { useThumbnailLoadQueue } from '@/composables/useThumbnailLoadQueue'
import standesdbService from '@/services/standesdbService'
import type { ImageOwnerRef, StandesdbImage } from '@/types/standesdb'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Tag from 'primevue/tag'

// Limits of the API (image_service: 5 MB, JPEG and PNG; ImageUpdateRequest: 100
// characters). The client checks them first so that a refused file costs no upload.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']
const MAX_DESCRIPTION = 100

interface GalleryResponse {
  owner: ImageOwnerRef
  images: StandesdbImage[]
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const { schedule } = useThumbnailLoadQueue()

// The self-service entry point (AppNavbar.vue's "Meine Profilbilder
// verwalten") uses its own route, not the admin-style /members/:id/images
// one - the caller isn't navigating away from a member/contact detail
// page, so there's nothing sensible for "Zurück" to go back to.
const isOwnRoute = computed(() => String(route.name) === 'standesdb-my-images')

const ownerType = computed(() => {
  if (isOwnRoute.value) return 'member'
  return String(route.name).includes('member') ? 'member' : 'contact'
})
const ownerId = computed<string>(() => {
  if (isOwnRoute.value) return authStore.user?.id ?? ''
  return String(route.params['id'])
})
const backRoute = computed(() =>
  ownerType.value === 'member'
    ? { name: 'standesdb-member-show', params: { id: ownerId.value } }
    : { name: 'standesdb-contact-show', params: { id: ownerId.value } },
)

const loading = ref(true)
const loadFailed = ref(false)
const uploading = ref(false)
const saving = ref(false)
const ownerCn = ref('')
const ownerOrgId = ref('')
const images = ref<StandesdbImage[]>([])
const imageUrls = ref<Record<string, string>>({})
let loadGalleryId = 0

const uploadFile = ref<File | null>(null)
const uploadDescription = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const editDialogVisible = ref(false)
const editImageId = ref('')
const editDescription = ref<string | null>(null)
const editDefault = ref(false)

const deleteDialogVisible = ref(false)
const deleteImageId = ref('')

const imageCountLabel = computed(
  () => `${images.value.length} Profilbild${images.value.length !== 1 ? 'er' : ''}`,
)

const isAdmin = computed(() => {
  const perms = authStore.user?.permissions ?? []
  if (ownerType.value === 'contact') {
    return perms.includes('standesdbContactAdmin')
  }
  const orgPerm = `standesdb${ownerOrgId.value.charAt(0).toUpperCase() + ownerOrgId.value.slice(1)}Admin`
  return perms.includes(orgPerm)
})

// Contacts have no self-service concept (they don't log in) - isSelf stays
// hard-gated to member galleries.
const isSelf = computed(() => ownerType.value === 'member' && authStore.user?.id === ownerId.value)

const canManage = computed(() => isAdmin.value || isSelf.value)

const requestGallery = () => {
  if (isOwnRoute.value) return standesdbService.getOwnImages()
  if (ownerType.value === 'member') return standesdbService.getMemberImages(ownerId.value)
  return standesdbService.getContactImages(ownerId.value)
}

const applyGallery = (data: GalleryResponse) => {
  ownerCn.value = data.owner.cn ?? ''
  ownerOrgId.value = data.owner.org_id ?? ''
  images.value = data.images
}

// Thumbnails are fetched through the shared load queue (a few at a time) and shown as
// they arrive; the page does not wait for them. A missing preview keeps its placeholder.
const loadPreviews = (generation: number, list: StandesdbImage[]) => {
  const owner = ownerType.value
  const id = ownerId.value
  list.forEach((img) => {
    schedule(async () => {
      try {
        const resp = await standesdbService.getImageUrl(owner, id, img.id, true)
        if (generation === loadGalleryId) imageUrls.value[img.id] = resp.data.url
      } catch {
        // the placeholder stays
      }
    })
  })
}

// Initial load and load after a change of the address: the old content goes away
// while the new one loads.
const loadGallery = async () => {
  const generation = ++loadGalleryId
  loading.value = true
  loadFailed.value = false
  images.value = []
  imageUrls.value = {}
  ownerCn.value = ''
  ownerOrgId.value = ''
  uploadFile.value = null
  uploadDescription.value = ''
  try {
    const resp = await requestGallery()
    if (generation !== loadGalleryId) return
    applyGallery(resp.data)
    loadPreviews(generation, resp.data.images)
  } catch (err: unknown) {
    if (generation !== loadGalleryId) return
    const status = getApiErrorStatus(err)
    if (status === 404 || status === 403) {
      router.replace({ name: 'not-found' })
      return
    }
    loadFailed.value = true
  } finally {
    if (generation === loadGalleryId) loading.value = false
  }
}

// Reload after an upload, edit or delete: the page stays where it is and the
// thumbnails already shown stay until their new address arrives.
const refreshGallery = async () => {
  const generation = ++loadGalleryId
  try {
    const resp = await requestGallery()
    if (generation !== loadGalleryId) return
    applyGallery(resp.data)
    loadPreviews(generation, resp.data.images)
  } catch {
    if (generation !== loadGalleryId) return
    toast.add({
      severity: 'warn',
      summary: 'Aktualisierung fehlgeschlagen',
      detail: 'Die Bildliste konnte nicht neu geladen werden.',
      life: 5000,
    })
  }
}

watch(() => [route.name, route.params['id']], loadGallery, { immediate: true })

const rejectFile = (input: HTMLInputElement, detail: string) => {
  toast.add({ severity: 'error', summary: 'Fehler', detail, life: 5000 })
  input.value = ''
  uploadFile.value = null
}

const onFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    rejectFile(input, 'Nur JPEG- und PNG-Dateien erlaubt.')
    return
  }
  if (file.size > MAX_IMAGE_BYTES) {
    rejectFile(input, 'Datei zu groß (max. 5 MB).')
    return
  }
  uploadFile.value = file
}

const doUpload = async () => {
  if (!uploadFile.value || uploading.value) return
  uploading.value = true
  const description = trimmedOrNull(uploadDescription.value)
  try {
    if (isSelf.value) {
      await standesdbService.uploadOwnImage(uploadFile.value, description)
    } else {
      await standesdbService.uploadImage(
        ownerType.value,
        ownerId.value,
        uploadFile.value,
        description,
      )
    }
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Profilbild gespeichert.',
      life: 3000,
    })
    uploadFile.value = null
    uploadDescription.value = ''
    if (fileInputRef.value) fileInputRef.value.value = ''
    await refreshGallery()
    await refreshNavbarAvatarIfSelf()
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

// The navbar avatar reads authStore.user.default_image, a snapshot from
// login/session-restore - it isn't automatically kept in sync with
// self-service gallery changes elsewhere in the app. Re-fetching here
// (same action already used after login/Google-link/-unlink) lets
// AppNavbar.vue's existing watch(() => authStore.user?.default_image, ...)
// pick up the change immediately, no page reload needed. Only relevant
// for isSelf - an admin editing someone else's gallery never affects
// their own navbar avatar.
const refreshNavbarAvatarIfSelf = async () => {
  if (isSelf.value) await authStore.fetchUser()
}

const openEdit = (img: StandesdbImage) => {
  editImageId.value = img.id
  editDescription.value = img.description
  editDefault.value = img.default
  editDialogVisible.value = true
}

const saveEdit = async () => {
  if (saving.value) return
  saving.value = true
  const data = { description: trimmedOrNull(editDescription.value), default: editDefault.value }
  try {
    if (isSelf.value) {
      await standesdbService.updateOwnImage(editImageId.value, data)
    } else {
      await standesdbService.updateImage(ownerType.value, ownerId.value, editImageId.value, data)
    }
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Änderungen gespeichert.',
      life: 3000,
    })
    editDialogVisible.value = false
    await refreshGallery()
    await refreshNavbarAvatarIfSelf()
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Speichern fehlgeschlagen.'),
      life: 5000,
    })
  } finally {
    saving.value = false
  }
}

const confirmDelete = (img: StandesdbImage) => {
  deleteImageId.value = img.id
  deleteDialogVisible.value = true
}

const doDelete = async () => {
  deleteDialogVisible.value = false
  try {
    if (isSelf.value) {
      await standesdbService.deleteOwnImage(deleteImageId.value)
    } else {
      await standesdbService.deleteImage(ownerType.value, ownerId.value, deleteImageId.value)
    }
    toast.add({
      severity: 'success',
      summary: 'Gelöscht',
      detail: 'Profilbild gelöscht.',
      life: 3000,
    })
    await refreshGallery()
    await refreshNavbarAvatarIfSelf()
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Löschen fehlgeschlagen.'),
      life: 5000,
    })
  }
}

// The presigned address forces a download (Content-Disposition: attachment), so
// the click below saves the file and does not leave the page.
const doDownload = async (img: StandesdbImage) => {
  try {
    const resp = await standesdbService.getImageUrl(ownerType.value, ownerId.value, img.id)
    const a = document.createElement('a')
    a.href = resp.data.url
    a.click()
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Download fehlgeschlagen.'),
      life: 5000,
    })
  }
}
</script>

<template>
  <div class="image-gallery">
    <div v-if="loadFailed" class="load-error">
      <Message severity="error" :closable="false"
        >Die Profilbilder konnten nicht geladen werden.</Message
      >
      <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="loadGallery" />
    </div>

    <template v-else-if="!loading">
      <div class="page-header">
        <h2 class="page-title">Standesdatenbank</h2>
        <h3 class="page-subtitle">Profilbilder</h3>
        <p class="page-name">
          {{ ownerCn }}
        </p>
        <div v-if="!isOwnRoute" class="header-actions">
          <Button
            label="Zurück"
            icon="pi pi-arrow-left"
            severity="info"
            size="small"
            @click="router.push(backRoute)"
          />
        </div>
      </div>

      <p class="image-count">{{ imageCountLabel }}</p>

      <!-- Upload -->
      <div v-if="canManage" class="upload-section">
        <label class="section-label">Neues Bild hochladen</label>
        <div class="upload-row">
          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png"
            class="upload-file-input"
            @change="onFileSelect"
          />
          <Button
            label="Datei wählen"
            icon="pi pi-image"
            severity="secondary"
            outlined
            size="small"
            @click="fileInputRef?.click()"
          />
          <span class="upload-filename">{{ uploadFile?.name ?? 'Keine Datei ausgewählt' }}</span>
          <InputText
            v-model="uploadDescription"
            aria-label="Beschreibung des neuen Bildes"
            placeholder="Beschreibung (optional, max. 100 Zeichen)"
            :maxlength="MAX_DESCRIPTION"
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
            <i class="pi pi-image" style="font-size: 2rem; color: var(--p-text-muted-color)" />
          </div>

          <div class="image-info">
            <div class="image-meta">
              <span v-if="img.width && img.height">{{ img.width }} × {{ img.height }} px</span>
              <span v-if="img.size">{{ formatSize(img.size) }}</span>
              <Tag v-if="img.default" value="Standard" severity="success" />
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
              <template v-if="canManage">
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
            <label for="edit-image-description">Beschreibung</label>
            <InputText
              id="edit-image-description"
              v-model="editDescription"
              :maxlength="MAX_DESCRIPTION"
              class="w-full"
            />
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
          <Button label="Speichern" :loading="saving" @click="saveEdit" />
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

.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
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
  border: 1px solid var(--app-border-card);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  background: var(--app-surface-card);
}

.upload-row {
  display: flex;
  gap: 0.75rem;
  flex-direction: column;
  align-items: stretch;
}

.upload-file-input {
  display: none;
}

.upload-filename {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  align-items: flex-start;
  gap: 1rem;
  border: 1px solid var(--app-border-card);
  border-radius: 8px;
  padding: 0.75rem;
  background: var(--app-surface-card);
}

.image-preview {
  max-width: 150px;
  max-height: 200px;
  border-radius: 6px;
  border: 1px solid var(--app-border-card);
  object-fit: contain;
}

.image-placeholder {
  width: 150px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-surface-subtle);
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
