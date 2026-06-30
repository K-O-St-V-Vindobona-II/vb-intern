<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useArchiveStore } from '@/stores/archive'
import { useArchiveDownload } from '@/composables/useArchiveDownload'
import archiveService from '@/services/archiveService'
import type { ArchiveSearchResult } from '@/services/archiveService'
import type { DirDetail } from '@/types/archive'
import DirPath from '@/components/archive/DirPath.vue'
import DirList from '@/components/archive/DirList.vue'
import FileList from '@/components/archive/FileList.vue'
import DirGallery from '@/components/archive/DirGallery.vue'
import DirEditor from '@/components/archive/DirEditor.vue'
import PermissionViewer from '@/components/archive/PermissionViewer.vue'
import ClipboardBar from '@/components/archive/ClipboardBar.vue'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'

const route = useRoute()
const router = useRouter()

const searchQuery = ref('')
const searchResults = ref<ArchiveSearchResult[]>([])
const searching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const onSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer)
  if (searchQuery.value.length < 3) {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(doSearch, 300)
}

const doSearch = async () => {
  if (searchQuery.value.length < 3) return
  searching.value = true
  try {
    const resp = await archiveService.searchArchive(searchQuery.value)
    searchResults.value = resp.data
  } catch {
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

const fileIcon = (ext: string | null | undefined): string => {
  switch ((ext || '').toLowerCase()) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return 'pi pi-image'
    case 'pdf':
      return 'pi pi-file-pdf'
    case 'doc':
    case 'docx':
      return 'pi pi-file-word'
    case 'xls':
    case 'xlsx':
      return 'pi pi-file-excel'
    default:
      return 'pi pi-file'
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  searchResults.value = []
}

const onResultClick = (result: ArchiveSearchResult) => {
  clearSearch()
  router.push({
    name: result.type === 'dir' ? 'archive-dir' : 'archive-file',
    params: { id: result.id },
  })
}
const authStore = useAuthStore()
const archiveStore = useArchiveStore()
const { loadPresignedUrl } = useArchiveDownload()

const loading = ref(true)
const dir = ref<DirDetail | null>(null)
const previewUrl = ref<string | null>(null)

const admin = computed(() => authStore.user?.permissions?.includes('archiveAdmin') ?? false)

const onPreview = async (id: number | null) => {
  if (!id) {
    previewUrl.value = null
    return
  }
  previewUrl.value = await loadPresignedUrl(id, 'lg')
}

const loadDir = async () => {
  loading.value = true
  try {
    const id = route.params.id ? Number(route.params.id) : null
    const resp = id ? await archiveService.getDirDetail(id) : await archiveService.getDirRoot()
    dir.value = resp.data
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

watch(
  () => route.params.id,
  () => {
    clearSearch()
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

    <div class="search-section">
      <div class="search-input-row">
        <i class="pi pi-search search-icon" />
        <InputText
          v-model="searchQuery"
          placeholder="Archiv durchsuchen (mind. 3 Zeichen)..."
          class="search-input"
          @input="onSearchInput"
        />
        <i v-if="searchQuery" class="pi pi-times search-clear" @click="clearSearch" />
      </div>
      <p class="search-hint">Erste Version — die Suche wird schrittweise verbessert.</p>

      <div v-if="searching" class="search-status">
        <i class="pi pi-spin pi-spinner" />
        Suche läuft...
      </div>

      <div v-if="searchResults.length && !searching" class="search-results">
        <div
          v-for="result in searchResults"
          :key="`${result.type}-${result.id}`"
          class="search-result"
          @click="onResultClick(result)"
        >
          <i
            :class="result.type === 'dir' ? 'pi pi-folder' : fileIcon(result.extension)"
            class="result-icon"
          />
          <div class="result-body">
            <span class="result-name">{{ result.name }}</span>
            <span v-if="result.description" class="result-desc">{{ result.description }}</span>
            <span class="result-path">{{ result.path }}</span>
          </div>
        </div>
      </div>

      <div
        v-if="searchQuery.length >= 3 && !searchResults.length && !searching"
        class="search-empty"
      >
        Keine Ergebnisse für "{{ searchQuery }}".
      </div>
    </div>

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
.search-section {
  margin-bottom: 1rem;
}
.search-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
}
.search-icon {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}
.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.9rem;
}
.search-input:focus {
  box-shadow: none;
}
.search-clear {
  color: var(--p-text-muted-color);
  cursor: pointer;
  font-size: 0.85rem;
}
.search-clear:hover {
  color: var(--p-text-color);
}
.search-hint {
  font-size: 0.75rem;
  color: var(--p-surface-400);
  margin: 0.3rem 0 0;
  font-style: italic;
}
.search-status {
  padding: 1rem 0;
  text-align: center;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}
.search-results {
  margin-top: 0.5rem;
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  overflow: hidden;
}
.search-result {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  transition: background-color 0.1s;
}
.search-result:hover {
  background: var(--p-surface-50);
}
.search-result + .search-result {
  border-top: 1px solid var(--p-surface-100);
}
.result-icon {
  color: var(--p-primary-color);
  font-size: 1rem;
  margin-top: 0.15rem;
  flex-shrink: 0;
}
.result-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.result-name {
  font-weight: 600;
  font-size: 0.9rem;
  word-break: break-word;
}
.result-desc {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}
.result-path {
  font-size: 0.75rem;
  color: var(--p-surface-400);
}
.search-empty {
  padding: 1rem 0;
  text-align: center;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
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
</style>
