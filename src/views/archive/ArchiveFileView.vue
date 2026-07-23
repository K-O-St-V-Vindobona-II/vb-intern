<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'primevue/usetoast'
import { useArchiveDownload } from '@/composables/useArchiveDownload'
import archiveService from '@/services/archiveService'
import { formatSize, formatDateTime } from '@/utils/formatters'
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

const admin = computed(() => authStore.user?.permissions?.includes('archiveAdmin') ?? false)

const editVisible = ref(false)
const editDescription = ref('')

const doDownload = () => {
  if (!file.value) return
  triggerDownload(file.value.id, `${file.value.name}.${file.value.extension}`)
}

const loadFile = async () => {
  loading.value = true
  try {
    const id = Number(route.params['id'])
    const resp = await archiveService.getFileDetail(id)
    file.value = resp.data
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

const openEdit = () => {
  editDescription.value = file.value?.description || ''
  editVisible.value = true
}

const saveDescription = async () => {
  if (!file.value) return
  try {
    await archiveService.updateFile(file.value.id, {
      description: editDescription.value || null,
    })
    editVisible.value = false
    await loadFile()
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      life: 3000,
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
  <div v-if="!loading && file" class="archive-file">
    <div class="file-header">
      <h2>Archiv</h2>
      <p class="file-subtitle">Archiv-Datei</p>
    </div>

    <!-- Download Card -->
    <div class="download-section">
      <div class="download-link" @click="doDownload">
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
        <div v-if="file.active_version" class="info-row">
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
            @click="openEdit"
          />
        </div>
      </template>
    </Card>

    <!-- Comments -->
    <FileComments :file-id="file.id" :comments="file.comments" :admin="admin" @changed="loadFile" />

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
    >
      <InputText v-model="editDescription" style="width: 100%" />
      <template #footer>
        <Button label="Abbrechen" severity="secondary" @click="editVisible = false" />
        <Button label="Speichern" severity="danger" @click="saveDescription" />
      </template>
    </Dialog>
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
</style>
