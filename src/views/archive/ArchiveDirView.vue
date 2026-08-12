<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useAuthStore } from '@/stores/auth'
import { useArchiveStore } from '@/stores/archive'
import { useArchiveDownload } from '@/composables/useArchiveDownload'
import archiveService from '@/services/archiveService'
import type { DirDetail } from '@/types/archive'
import { formatApiError, formatSize } from '@/utils/formatters'
import Button from 'primevue/button'
import DirPath from '@/components/archive/DirPath.vue'
import DirList from '@/components/archive/DirList.vue'
import FileList from '@/components/archive/FileList.vue'
import DirGallery from '@/components/archive/DirGallery.vue'
import DirEditor from '@/components/archive/DirEditor.vue'
import PermissionViewer from '@/components/archive/PermissionViewer.vue'
import ClipboardBar from '@/components/archive/ClipboardBar.vue'
import Card from 'primevue/card'
import SearchField from '@/components/SearchField.vue'
import type { SearchResult } from '@/components/SearchField.vue'

const route = useRoute()
const router = useRouter()

interface ArchiveSearchItem extends SearchResult {
  type: 'file' | 'dir'
}

const searchArchive = async (query: string): Promise<SearchResult[]> => {
  const resp = await archiveService.searchArchive(query)
  return resp.data.map(
    (r): ArchiveSearchItem => ({
      id: r.id,
      type: r.type,
      label: `${r.type === 'dir' ? 'Verzeichnis' : 'Datei'}: ${r.name ?? '(unbenannt)'} (${r.path})`,
    }),
  )
}

const onArchiveResultSelect = (item: SearchResult) => {
  const typed = item as ArchiveSearchItem
  router.push({
    name: typed.type === 'dir' ? 'archive-dir' : 'archive-file',
    params: { id: typed.id },
  })
}

const authStore = useAuthStore()
const archiveStore = useArchiveStore()
const { loadPresignedUrl } = useArchiveDownload()
const toast = useToast()

const loading = ref(true)
const dir = ref<DirDetail | null>(null)
const loadError = ref(false)
const previewUrl = ref<string | null>(null)

const admin = computed(() => authStore.user?.permissions?.includes('archiveAdmin') ?? false)
const extensionStatsExpanded = ref(false)

const onPreview = async (id: number | null) => {
  if (!id) {
    previewUrl.value = null
    return
  }
  previewUrl.value = await loadPresignedUrl(id, 'lg')
}

const loadDir = async () => {
  loading.value = true
  loadError.value = false
  try {
    const id = route.params['id'] ? Number(route.params['id']) : null
    const resp = id ? await archiveService.getDirDetail(id) : await archiveService.getDirRoot()
    dir.value = resp.data
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404 || status === 403) {
      router.replace({ name: 'not-found' })
      return
    }
    loadError.value = true
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Verzeichnis konnte nicht geladen werden.'),
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params['id'],
  () => {
    loadDir()
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="!loading && dir" class="archive-dir">
    <div class="dir-header">
      <h2>Archiv</h2>
      <p class="dir-subtitle">Archiv-Verzeichnis</p>
    </div>

    <Card class="search-card">
      <template #content>
        <div class="search-row">
          <SearchField
            :search-fn="searchArchive"
            :min-length="2"
            placeholder="Archiv durchsuchen (mind. 2 Zeichen)..."
            class="search-input"
            @select="onArchiveResultSelect"
          />
        </div>
      </template>
    </Card>

    <ClipboardBar v-if="admin" :target-dir-id="dir.id" @moved="loadDir" />

    <img v-if="previewUrl" :src="previewUrl" class="hover-preview" />

    <!-- Dir Info -->
    <Card class="dir-info-card">
      <template #content>
        <h5 class="dir-name">
          {{ dir.name }}
        </h5>
        <div v-if="dir.description" class="dir-desc">
          {{ dir.description }}
        </div>
        <div v-if="dir.id" class="dir-path-row">
          Pfad:
          <DirPath :path="dir.path" />
        </div>

        <div v-if="!dir.id && dir.stats" class="archive-stats">
          <div class="stat-item">
            <span class="stat-value">{{ dir.stats.file_count }}</span>
            <span class="stat-label">Dateien</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ dir.stats.unique_object_count }}</span>
            <span class="stat-label">Eindeutige Objekte</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ dir.stats.dir_count }}</span>
            <span class="stat-label">Verzeichnisse</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ formatSize(dir.stats.total_size) }}</span>
            <span class="stat-label">Speicherplatz</span>
          </div>
        </div>

        <div v-if="!dir.id && dir.stats?.by_extension.length" class="stats-by-extension">
          <div class="stats-toggle" @click="extensionStatsExpanded = !extensionStatsExpanded">
            <i
              :class="extensionStatsExpanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
              class="stats-caret"
            />
            <span>Nach Dateityp</span>
          </div>
          <div v-if="extensionStatsExpanded" class="stats-by-extension-wrap">
            <table>
              <thead>
                <tr>
                  <th>Anzahl</th>
                  <th>Größe</th>
                  <th>Typ</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in dir.stats.by_extension" :key="row.extension">
                  <td>{{ row.count }}</td>
                  <td>{{ formatSize(row.size) }}</td>
                  <td>{{ row.extension }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="dir.id && admin">
          <PermissionViewer
            v-model="dir.permissions.effective"
            title="Effektive Berechtigungen"
            :orgs="dir.sets.orgs"
            :states="dir.sets.states"
          />
          <template v-if="admin">
            <PermissionViewer
              v-model="dir.permissions.own"
              title="Eigene Berechtigung"
              :orgs="dir.sets.orgs"
              :states="dir.sets.states"
              :recursive="dir.recursive_permissions"
            />
            <PermissionViewer
              v-model="dir.permissions.parent"
              title="Eltern-Berechtigung"
              :orgs="dir.sets.orgs"
              :states="dir.sets.states"
            />
            <DirEditor
              :sets="dir.sets"
              :dir-id="dir.id"
              :dir-name="dir.name"
              :dir-description="dir.description"
              :dir-permissions="dir.permissions.own"
              :dir-recursive="dir.recursive_permissions"
              @saved="loadDir"
            />
          </template>
        </div>
      </template>
    </Card>

    <!-- Gallery -->
    <DirGallery :files="dir.content.files.insight" />

    <!-- Content: insight -->
    <DirList
      :items="dir.content.subdirs.insight"
      title="Verzeichnisse"
      :admin="admin"
      @changed="loadDir"
    />
    <FileList
      :items="dir.content.files.insight"
      title="Dateien"
      :admin="admin"
      @changed="loadDir"
      @preview="onPreview"
    />

    <!-- Admin section -->
    <div v-if="admin" class="admin-section">
      <div v-if="archiveStore.showAdmin" class="admin-panel">
        <Card>
          <template #title>
            <div class="admin-header">
              <span>Administration</span>
              <a class="admin-toggle" @click="archiveStore.showAdmin = false">
                Administration verbergen
              </a>
            </div>
          </template>
          <template #content>
            <DirList
              :items="dir.content.subdirs.admin"
              title="Verzeichnisse ohne Berechtigung"
              admin
              @changed="loadDir"
            />
            <FileList
              :items="dir.content.files.admin"
              :title="dir.id ? 'Dateien ohne Berechtigung' : 'Unsortierte Uploads'"
              admin
              @changed="loadDir"
              @preview="onPreview"
            />

            <div class="create-dir-row">
              <DirEditor :sets="dir.sets" :parent-id="dir.id" create @saved="loadDir" />
            </div>

            <DirList
              :items="dir.content.subdirs.trashed"
              title="Gelöschte Verzeichnisse"
              admin
              trash
              @changed="loadDir"
            />
            <FileList
              :items="dir.content.files.trashed"
              title="Gelöschte Dateien"
              admin
              trash
              @changed="loadDir"
              @preview="onPreview"
            />
          </template>
        </Card>
      </div>
      <div v-else class="admin-toggle-row">
        <a class="admin-toggle" @click="archiveStore.showAdmin = true"> Administration </a>
      </div>
    </div>
  </div>
  <div v-else-if="!loading && loadError" class="archive-error">
    <p>Verzeichnis konnte nicht geladen werden.</p>
    <Button label="Erneut versuchen" icon="pi pi-refresh" @click="loadDir" />
  </div>
</template>

<style scoped>
.archive-dir {
  max-width: 900px;
  margin: 0 auto;
}
.dir-header {
  margin-bottom: 1rem;
}
.dir-subtitle {
  color: var(--p-text-muted-color);
  margin: 0;
}
.search-card {
  margin-bottom: 1rem;
}
.search-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}
.search-input {
  flex: 1;
}
.search-input :deep(input) {
  width: 100%;
}
.dir-info-card {
  margin-bottom: 1rem;
}
.dir-name {
  margin: 0 0 0.25rem;
}
.dir-desc {
  color: var(--p-text-muted-color);
  margin-bottom: 0.5rem;
}
.dir-path-row {
  margin: 0.5rem 0;
}
.archive-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  margin: 0.75rem 0;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 5rem;
}
.stat-value {
  font-size: 1.4rem;
  font-weight: 600;
}
.stat-label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  text-align: center;
}
.stats-toggle {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}
.stats-caret {
  font-size: 0.7rem;
  margin-right: 0.4rem;
  color: var(--p-text-muted-color);
}
.stats-by-extension-wrap {
  overflow-x: auto;
  margin: 0.5rem 0;
}
.stats-by-extension-wrap table {
  border-collapse: collapse;
  width: 100%;
}
.stats-by-extension-wrap th,
.stats-by-extension-wrap td {
  text-align: left;
  padding: 0.25rem 0.75rem 0.25rem 0;
  border-bottom: 1px solid var(--app-border-card);
}
.hover-preview {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  max-width: 80vw;
  max-height: 80vh;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}
.admin-section {
  margin-top: 2rem;
}
.admin-panel {
  margin: 1rem 0;
}
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
}
.admin-toggle {
  color: var(--p-primary-color);
  cursor: pointer;
  font-size: 0.9rem;
}
.admin-toggle:hover {
  text-decoration: underline;
}
.admin-toggle-row {
  text-align: center;
  margin: 1rem 0;
}
.create-dir-row {
  margin: 1.5rem 0;
  text-align: center;
}
.archive-error {
  max-width: 900px;
  margin: 3rem auto;
  text-align: center;
  color: var(--p-text-muted-color);
}
</style>
