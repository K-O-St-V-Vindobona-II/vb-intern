<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'primevue/usetoast'
import { useArchiveDownload } from '@/composables/useArchiveDownload'
import archiveService from '@/services/archiveService'
import { formatSize, formatDateTime, formatApiError, getApiErrorStatus } from '@/utils/formatters'
import type { FileDetail } from '@/types/archive'
import DirPath from '@/components/archive/DirPath.vue'
import FileIcon from '@/components/archive/FileIcon.vue'
import FileComments from '@/components/archive/FileComments.vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const { triggerDownload } = useArchiveDownload()

const loading = ref(true)
const file = ref<FileDetail | null>(null)
const loadError = ref(false)

const admin = computed(() => authStore.user?.permissions?.includes('archiveAdmin') ?? false)

// Same limit as the API.
const MAX_DESCRIPTION_LENGTH = 128

const editVisible = ref(false)
const editDescription = ref('')

const doDownload = () => {
  if (!file.value) return
  triggerDownload(file.value.id, `${file.value.name}.${file.value.extension}`)
}

// Reads the file of the current address in place. Also used after a change (description,
// comments): the page stays mounted, so the scroll position and the comment form survive.
// Answers arrive in any order: a slow answer for the file opened before must not replace
// the one on screen, and its 404 must not send the user to "not found".
let latestFileRequestId = 0

const refreshFile = async () => {
  const requestId = ++latestFileRequestId
  try {
    const resp = await archiveService.getFileDetail(String(route.params['id']))
    if (requestId !== latestFileRequestId) return
    file.value = resp.data
  } catch (err: unknown) {
    if (requestId !== latestFileRequestId) return
    if ([403, 404].includes(getApiErrorStatus(err) ?? 0)) {
      router.replace({ name: 'not-found' })
      return
    }
    loadError.value = !file.value
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Datei konnte nicht geladen werden.'),
      life: 5000,
    })
  } finally {
    if (requestId === latestFileRequestId) loading.value = false
  }
}

// Opening another file (and the retry button): the old file goes away while the new one
// loads.
const loadFile = async () => {
  file.value = null
  loadError.value = false
  loading.value = true
  await refreshFile()
}

const openEdit = () => {
  editDescription.value = file.value?.description || ''
  editVisible.value = true
}

const saveDescription = async () => {
  if (!file.value) return
  try {
    await archiveService.updateFile(file.value.id, {
      description: editDescription.value.trim() || null,
    })
    editVisible.value = false
    await refreshFile()
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Beschreibung konnte nicht gespeichert werden.'),
      life: 5000,
    })
  }
}

const goToDir = () => {
  if (!file.value) return
  const dirId = file.value.archive_dir_id
  if (dirId) {
    router.push({
      name: 'archive-dir',
      params: { id: dirId },
    })
  } else {
    router.push({ name: 'archive-root' })
  }
}

watch(
  () => route.params['id'],
  () => loadFile(),
  { immediate: true },
)
</script>

<template>
  <div v-if="file" class="archive-file">
    <div class="file-header">
      <h2>Archiv</h2>
      <p class="file-subtitle">Archiv-Datei</p>
    </div>

    <!-- Download Card -->
    <div class="download-section">
      <div
        class="download-link"
        role="button"
        tabindex="0"
        :aria-label="`${file.name}.${file.extension} herunterladen`"
        @click="doDownload"
        @keydown.enter.prevent="doDownload"
        @keydown.space.prevent="doDownload"
      >
        <Card class="download-card">
          <template #title>
            <div class="download-title">{{ file.name }}.{{ file.extension }}</div>
          </template>
          <template #content>
            <div class="download-icon-wrap">
              <FileIcon
                :extension="file.extension"
                :is-image="file.is_image"
                :file-id="file.id"
                size="md"
              />
            </div>
          </template>
          <template #footer>
            <div class="download-footer">Herunterladen</div>
          </template>
        </Card>
      </div>
    </div>

    <!-- File Info -->
    <div v-if="file.path.length" class="file-path-row">
      <DirPath :path="file.path" />
    </div>

    <Card class="info-card">
      <template #content>
        <div class="info-row">
          <strong>Größe:</strong>
          <span>{{ formatSize(file.size) }}</span>
        </div>
        <div class="info-row">
          <strong>Erstellt am:</strong>
          <span>{{ formatDateTime(file.created_at) }}</span>
        </div>
        <div class="info-row">
          <strong>Erstellt von:</strong>
          <span>{{ file.active_version.created_by }}</span>
        </div>
        <div class="info-row">
          <strong>Beschreibung:</strong>
          <span>{{ file.description }}</span>
          <Button
            v-if="admin"
            v-tooltip="'Bearbeiten'"
            icon="pi pi-pencil"
            severity="secondary"
            text
            size="small"
            aria-label="Beschreibung bearbeiten"
            @click="openEdit"
          />
        </div>
      </template>
    </Card>

    <!-- Comments -->
    <FileComments
      :file-id="file.id"
      :comments="file.comments"
      :admin="admin"
      @changed="refreshFile"
    />

    <!-- Back to dir -->
    <div class="back-row">
      <Button label="Zum Verzeichnis" icon="pi pi-arrow-left" severity="primary" @click="goToDir" />
    </div>

    <!-- Edit Dialog -->
    <Dialog
      v-model:visible="editVisible"
      header="Beschreibung bearbeiten"
      modal
      :style="{ width: '400px' }"
      :breakpoints="{ '600px': '95vw' }"
    >
      <label for="edit-file-description" class="edit-label">Beschreibung</label>
      <InputText
        id="edit-file-description"
        v-model="editDescription"
        :maxlength="MAX_DESCRIPTION_LENGTH"
        fluid
      />
      <template #footer>
        <Button label="Abbrechen" severity="secondary" @click="editVisible = false" />
        <Button label="Speichern" @click="saveDescription" />
      </template>
    </Dialog>
  </div>
  <div v-else-if="!loading && loadError" class="archive-error">
    <p>Datei konnte nicht geladen werden.</p>
    <Button label="Erneut versuchen" icon="pi pi-refresh" @click="loadFile" />
  </div>
</template>

<style scoped>
.archive-file {
  max-width: 800px;
  margin: 0 auto;
}
.file-header {
  margin-bottom: 1rem;
}
.file-subtitle {
  color: var(--p-text-muted-color);
  margin: 0;
}
.download-section {
  display: flex;
  justify-content: center;
  margin: 1rem 0;
}
.download-link {
  text-decoration: none;
  color: inherit;
  max-width: 300px;
  width: 100%;
  cursor: pointer;
  user-select: none;
}
.download-card {
  text-align: center;
}
.download-title {
  font-size: 1rem;
}
.download-icon-wrap {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}
.download-footer {
  font-size: 1.1rem;
  font-weight: 600;
  text-align: center;
}
.file-path-row {
  text-align: center;
  margin: 1rem 0;
}
.edit-label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
}
.info-card {
  max-width: 600px;
  margin: 0 auto;
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
}
.info-row strong {
  flex-shrink: 0;
}
.back-row {
  text-align: center;
  margin: 1.5rem 0 2rem;
}
.archive-error {
  max-width: 800px;
  margin: 3rem auto;
  text-align: center;
  color: var(--p-text-muted-color);
}
</style>
