<script setup lang="ts">
import { formatApiError } from '@/utils/formatters'
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import archiveService from '@/services/archiveService'
import { formatDate, formatSize } from '@/utils/formatters'
import type { FileShort, UploadConfig } from '@/types/archive'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ProgressBar from 'primevue/progressbar'

interface PreparedFile {
  file: File
  valid: boolean
  error: string | null
}

const toast = useToast()

const config = ref<UploadConfig | null>(null)
const description = ref('')
const preparedFiles = ref<PreparedFile[]>([])
const uploading = ref(false)
const uploadProgress = ref(0)
const dragOver = ref(false)
const unfiled = ref<FileShort[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)

const validFiles = computed(() => preparedFiles.value.filter((f) => f.valid))
const invalidFiles = computed(() => preparedFiles.value.filter((f) => !f.valid))

const descriptionValid = computed(() => {
  if (!config.value) return false
  return (
    description.value.length >= config.value.descminlength &&
    description.value.length <= config.value.descmaxlength
  )
})

const canUpload = computed(
  () => validFiles.value.length > 0 && descriptionValid.value && !uploading.value,
)

const validateFile = (file: File): PreparedFile => {
  if (!config.value) return { file, valid: false, error: 'Konfiguration nicht geladen.' }

  const parts = file.name.split('.')
  if (parts.length < 2) {
    return { file, valid: false, error: 'Keine Dateiendung.' }
  }

  const ext = parts.pop()!.toLowerCase()
  if (!config.value.extensions.includes(ext)) {
    return { file, valid: false, error: `Format ".${ext}" nicht erlaubt.` }
  }

  if (file.size < config.value.minfilesize * 1024) {
    return { file, valid: false, error: `Zu klein (min. ${config.value.minfilesize} KB).` }
  }

  if (file.size > config.value.maxfilesize * 1024) {
    return { file, valid: false, error: `Zu groß (max. ${config.value.maxfilesize / 1024} MB).` }
  }

  return { file, valid: true, error: null }
}

const addFiles = (files: FileList | File[]) => {
  for (const file of files) {
    const existing = preparedFiles.value.find(
      (p) => p.file.name === file.name && p.file.size === file.size,
    )
    if (!existing) {
      preparedFiles.value.push(validateFile(file))
    }
  }
}

const removeFile = (index: number) => {
  preparedFiles.value.splice(index, 1)
}

const onFileInput = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files) addFiles(input.files)
  input.value = ''
}

const onDrop = (e: DragEvent) => {
  dragOver.value = false
  if (e.dataTransfer?.files) addFiles(e.dataTransfer.files)
}

const openFilePicker = () => fileInputRef.value?.click()

const fileIcon = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'pi-image'
  if (ext === 'pdf') return 'pi-file-pdf'
  if (['doc', 'docx', 'txt'].includes(ext)) return 'pi-file-word'
  if (['xls', 'xlsx'].includes(ext)) return 'pi-file-excel'
  if (['mp3', 'mpga'].includes(ext)) return 'pi-volume-up'
  if (['mp4', 'avi'].includes(ext)) return 'pi-video'
  return 'pi-file'
}

const startUpload = async () => {
  uploading.value = true
  uploadProgress.value = 0
  const total = validFiles.value.length
  let done = 0
  const errors: string[] = []

  for (const pf of validFiles.value) {
    try {
      await archiveService.uploadFile(pf.file, description.value)
    } catch (err: unknown) {
      const msg = formatApiError(err, 'Unbekannter Fehler')
      errors.push(`${pf.file.name}: ${msg}`)
    }
    done++
    uploadProgress.value = Math.round((done / total) * 100)
  }

  preparedFiles.value = []
  description.value = ''
  await loadUnfiled()
  uploading.value = false

  if (errors.length) {
    toast.add({
      severity: 'warn',
      summary: `${done - errors.length} von ${total} hochgeladen`,
      detail: errors.join('\n'),
      life: 8000,
    })
  } else {
    toast.add({
      severity: 'success',
      summary: `${total} ${total === 1 ? 'Datei' : 'Dateien'} erfolgreich hochgeladen!`,
      life: 4000,
    })
  }
}

const loadUnfiled = async () => {
  try {
    const resp = await archiveService.getUnfiledUploads()
    unfiled.value = resp.data.files
  } catch {
    /* empty */
  }
}

onMounted(async () => {
  const resp = await archiveService.getUploadConfig()
  config.value = resp.data
  await loadUnfiled()
})
</script>

<template>
  <div class="upload-page">
    <div class="page-header">
      <h2>Archiv</h2>
      <p class="subtitle">Upload Center</p>
    </div>

    <Card class="intro-card">
      <template #content>
        <div class="intro-text">
          <i class="pi pi-cloud-upload intro-icon" />
          <p>
            Hier kannst du Fotos, Dokumente und andere Dateien ins Verbindungs-Archiv hochladen.
            Jede Datei bereichert unser gemeinsames Archiv!
          </p>
        </div>
      </template>
    </Card>

    <!-- Drag & Drop Zone -->
    <div
      class="drop-zone"
      :class="{ 'drop-zone-active': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
      @click="openFilePicker"
    >
      <input
        ref="fileInputRef"
        type="file"
        multiple
        class="hidden-input"
        :disabled="uploading"
        @change="onFileInput"
      />
      <i class="pi pi-cloud-upload drop-icon" />
      <div class="drop-title">Dateien hierher ziehen</div>
      <div class="drop-subtitle">oder klicken zum Auswählen</div>
      <div v-if="config" class="drop-hints">
        <span>Erlaubte Formate: {{ config.extensions.join(', ') }}</span>
        <span>Max. {{ config.maxfilesize / 1024 }} MB pro Datei</span>
      </div>
    </div>

    <!-- File List -->
    <div v-if="preparedFiles.length" class="file-list-section">
      <h3>Ausgewählte Dateien ({{ preparedFiles.length }})</h3>
      <div class="file-list">
        <div
          v-for="(pf, index) in preparedFiles"
          :key="`${pf.file.name}-${pf.file.size}`"
          class="file-item"
          :class="{ 'file-item-invalid': !pf.valid }"
        >
          <i
            :class="[
              'pi',
              pf.valid ? fileIcon(pf.file.name) : 'pi-exclamation-triangle',
              'file-type-icon',
            ]"
          />
          <div class="file-info">
            <span class="file-name">{{ pf.file.name }}</span>
            <span class="file-size">{{ formatSize(pf.file.size) }}</span>
            <span v-if="pf.error" class="file-error">{{ pf.error }}</span>
          </div>
          <i class="pi pi-times file-remove" @click="removeFile(index)" />
        </div>
      </div>

      <div v-if="invalidFiles.length && validFiles.length" class="file-summary">
        {{ validFiles.length }} {{ validFiles.length === 1 ? 'Datei' : 'Dateien' }} bereit,
        {{ invalidFiles.length }} {{ invalidFiles.length === 1 ? 'wird' : 'werden' }} übersprungen
      </div>
    </div>

    <!-- Description + Upload -->
    <div v-if="validFiles.length && config" class="upload-form">
      <label class="desc-label">
        Beschreibung
        <small class="desc-counter"> {{ description.length }} / {{ config.descmaxlength }} </small>
      </label>
      <InputText
        v-model="description"
        class="desc-input"
        :placeholder="`z.B. Fotos vom Stiftungsfest ${new Date().getFullYear()}`"
        :disabled="uploading"
        :maxlength="config.descmaxlength"
      />
      <small
        v-if="description.length > 0 && description.length < config.descminlength"
        class="desc-hint"
      >
        Mindestens {{ config.descminlength }} Zeichen
      </small>

      <div v-if="uploading" class="progress-section">
        <ProgressBar :value="uploadProgress" :show-value="true" />
      </div>

      <Button
        :label="uploading ? 'Wird hochgeladen...' : 'Hochladen'"
        icon="pi pi-upload"
        severity="success"
        size="large"
        :disabled="!canUpload"
        :loading="uploading"
        class="upload-btn"
        @click="startUpload"
      />
    </div>

    <!-- Unfiled Uploads -->
    <Card v-if="unfiled.length" class="unfiled-card">
      <template #title>
        <div class="unfiled-header">
          <i class="pi pi-inbox" />
          Meine unsortierten Uploads ({{ unfiled.length }})
        </div>
      </template>
      <template #subtitle>
        <span class="unfiled-hint">
          Diese Dateien warten darauf, vom Admin in einen Ordner eingeordnet zu werden.
        </span>
      </template>
      <template #content>
        <DataTable :value="unfiled" striped-rows size="small">
          <Column field="name" header="Name" sortable>
            <template #body="{ data }">
              <i :class="['pi', fileIcon(`${data.name}.${data.extension}`), 'unfiled-icon']" />
              {{ data.name }}.{{ data.extension }}
              <small class="file-size-muted"> ({{ formatSize(data.size) }}) </small>
            </template>
          </Column>
          <Column field="description" header="Beschreibung" sortable />
          <Column field="created_at" header="Datum" sortable style="width: 100px">
            <template #body="{ data }">
              {{ formatDate(data.created_at) }}
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.upload-page {
  max-width: 700px;
  margin: 0 auto;
}
.page-header {
  text-align: center;
  margin-bottom: 1rem;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0;
}
.intro-card {
  margin-bottom: 1.5rem;
}
.intro-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}
.intro-icon {
  font-size: 2rem;
  color: var(--p-primary-400);
  flex-shrink: 0;
}
.intro-text p {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Drop Zone */
.drop-zone {
  border: 2px dashed var(--p-surface-300);
  border-radius: 12px;
  padding: 1.5rem 1rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--p-surface-50);
  margin-bottom: 1.5rem;
}
.drop-zone:hover {
  border-color: var(--p-primary-400);
  background: var(--p-primary-50);
}
.drop-zone-active {
  border-color: var(--p-primary-500);
  background: var(--p-primary-100);
  transform: scale(1.01);
}
.hidden-input {
  display: none;
}
.drop-icon {
  font-size: 3rem;
  color: var(--p-primary-400);
  margin-bottom: 0.75rem;
  display: block;
}
.drop-title {
  font-size: 1.15rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}
.drop-subtitle {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}
.drop-hints {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

/* File List */
.file-list-section {
  margin-bottom: 1.5rem;
}
.file-list-section h3 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}
.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.file-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-50);
  border: 1px solid var(--p-surface-200);
}
.file-item-invalid {
  background: var(--p-red-50);
  border-color: var(--p-red-200);
}
.file-type-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
  color: var(--p-primary-500);
}
.file-item-invalid .file-type-icon {
  color: var(--p-red-500);
}
.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem;
}
.file-name {
  font-weight: 500;
  word-break: break-all;
}
.file-size {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}
.file-error {
  width: 100%;
  color: var(--p-red-600);
  font-size: 0.8rem;
}
.file-remove {
  cursor: pointer;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
  padding: 0.25rem;
}
.file-remove:hover {
  color: var(--p-red-600);
}
.file-summary {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  text-align: center;
}

/* Upload Form */
.upload-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
}
.desc-label {
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 450px;
  font-weight: 600;
  font-size: 0.85rem;
}
.desc-counter {
  font-weight: 400;
  color: var(--p-text-muted-color);
}
.desc-input {
  width: 100%;
  max-width: 450px;
}
.desc-hint {
  color: var(--p-red-500);
  font-size: 0.8rem;
}
.progress-section {
  width: 100%;
  max-width: 450px;
  margin: 0.5rem 0;
}
.upload-btn {
  margin-top: 0.5rem;
}

/* Unfiled */
.unfiled-card {
  margin-top: 2rem;
}
.unfiled-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
}
.unfiled-hint {
  font-size: 0.8rem;
}
.unfiled-icon {
  margin-right: 0.3rem;
  color: var(--p-primary-500);
}
.file-size-muted {
  color: var(--p-text-muted-color);
}

@media (min-width: 640px) {
  .drop-zone {
    padding: 2.5rem 1.5rem;
  }
  .intro-text {
    flex-direction: row;
    text-align: left;
  }
}
</style>
