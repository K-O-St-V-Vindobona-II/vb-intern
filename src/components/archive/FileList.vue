<script setup lang="ts">
import { toRef } from 'vue'
import { RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useArchiveStore } from '@/stores/archive'
import { useArchiveDownload } from '@/composables/useArchiveDownload'
import { useShiftSelect } from '@/composables/useShiftSelect'
import type { FileShort } from '@/types/archive'
import { formatApiError, formatDate, formatSize } from '@/utils/formatters'
import archiveService from '@/services/archiveService'
import FileIcon from './FileIcon.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'

const props = defineProps<{
  items: FileShort[]
  title: string
  admin?: boolean
  trash?: boolean
}>()

const emit = defineEmits<{
  (e: 'changed'): void
  (e: 'preview', id: string | null): void
}>()

const toast = useToast()
const confirm = useConfirm()
const store = useArchiveStore()
const { triggerDownload } = useArchiveDownload()
const { isSelected, toggle, toggleAll, allSelected, selectedItems, deselectAll } = useShiftSelect<
  FileShort,
  string
>(toRef(props, 'items'), (f) => f.id)
let previewTimer: ReturnType<typeof setTimeout> | null = null

const startPreview = (id: string) => {
  cancelPreview()
  previewTimer = setTimeout(() => emit('preview', id), 300)
}

const cancelPreview = () => {
  if (previewTimer) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
  emit('preview', null)
}

// "ontouchstart" exists on every touch-capable laptop too, which would switch
// the hover preview off for mouse users there; the media query asks whether
// the primary input can hover at all.
const canHover = () => !window.matchMedia('(hover: none)').matches

const startPreviewFor = (file: FileShort) => {
  if (!file.is_image || !canHover()) return
  startPreview(file.id)
}

const fileLabel = (file: FileShort) => `${file.name}.${file.extension}`

const copyToClipboard = () => {
  const items = selectedItems.value.map((f) => `file:${f.id}`)
  store.addToClipboard(items)
  deselectAll()
}

const toggleTrash = (file: FileShort, isTrash: boolean) => {
  confirm.require({
    message: isTrash ? 'Datei wiederherstellen?' : 'Datei wirklich löschen?',
    header: 'Bestätigung',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: {
      label: 'Abbrechen',
      severity: 'secondary',
    },
    acceptProps: {
      label: isTrash ? 'Wiederherstellen' : 'Löschen',
      severity: isTrash ? 'primary' : 'danger',
    },
    accept: async () => {
      try {
        if (isTrash) {
          await archiveService.restoreFile(file.id)
        } else {
          await archiveService.deleteFile(file.id)
        }
        emit('changed')
      } catch (err) {
        toast.add({
          severity: 'error',
          summary: 'Fehler',
          detail: formatApiError(
            err,
            isTrash
              ? 'Datei konnte nicht wiederhergestellt werden.'
              : 'Datei konnte nicht gelöscht werden.',
          ),
          life: 3000,
        })
      }
    },
  })
}
</script>

<template>
  <div v-if="items.length" class="file-list">
    <div class="list-header">
      <strong>{{ title }} ({{ items.length }})</strong>
      <Button
        v-if="admin && !trash"
        v-tooltip="'In Zwischenablage'"
        aria-label="Ausgewählte Dateien in die Zwischenablage"
        icon="pi pi-copy"
        severity="danger"
        text
        size="small"
        :style="{
          visibility: selectedItems.length ? 'visible' : 'hidden',
        }"
        @click="copyToClipboard"
      />
    </div>
    <DataTable :value="items" data-key="id" striped-rows size="small" scrollable>
      <Column v-if="admin && !trash" style="width: 2.5rem; min-width: 2.5rem; max-width: 2.5rem">
        <template #header>
          <div class="select-cell" @click.prevent="toggleAll()">
            <Checkbox :model-value="allSelected" :binary="true" aria-label="Alle auswählen" />
          </div>
        </template>
        <template #body="{ data }">
          <div class="select-cell" @click="toggle(data, $event)">
            <Checkbox
              :model-value="isSelected(data)"
              :binary="true"
              :aria-label="`${fileLabel(data)} auswählen`"
            />
          </div>
        </template>
      </Column>
      <Column v-if="!trash" style="width: 40px">
        <template #body="{ data }">
          <button
            v-tooltip="'Herunterladen'"
            type="button"
            class="download-btn"
            :aria-label="`${fileLabel(data)} herunterladen`"
            @click="triggerDownload(data.id, fileLabel(data))"
          >
            <i class="pi pi-download" />
          </button>
        </template>
      </Column>
      <Column field="name" header="Name" sortable>
        <template #body="{ data }">
          <span class="file-name-cell">
            <span
              class="file-icon-wrap"
              @mouseenter="startPreviewFor(data)"
              @mouseleave="cancelPreview()"
            >
              <FileIcon :extension="data.extension" :is-image="data.is_image" :file-id="data.id" />
            </span>
            <RouterLink :to="{ name: 'archive-file', params: { id: data.id } }" class="file-link">
              {{ fileLabel(data) }}
            </RouterLink>
            <small class="file-size"> ({{ formatSize(data.size) }}) </small>
          </span>
        </template>
      </Column>
      <Column field="description" header="Beschreibung" sortable />
      <Column
        :field="trash ? 'deleted_at' : 'created_at'"
        :header="trash ? 'Löschdatum' : 'Erstelldatum'"
        sortable
        style="width: 120px"
      >
        <template #body="{ data }">
          {{ formatDate(trash ? data.deleted_at : data.created_at) }}
        </template>
      </Column>
      <Column v-if="admin" style="width: 60px">
        <template #body="{ data }">
          <Button
            v-tooltip="trash ? 'Wiederherstellen' : 'Löschen'"
            :aria-label="`${fileLabel(data)} ${trash ? 'wiederherstellen' : 'löschen'}`"
            :icon="trash ? 'pi pi-replay' : 'pi pi-trash'"
            severity="secondary"
            text
            size="small"
            @click="toggleTrash(data, !!trash)"
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.file-list {
  margin: 1rem 0;
}
.file-list :deep(td),
.file-list :deep(th) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
}
.list-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.file-name-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.file-icon-wrap {
  display: inline-block;
  width: 22px;
  text-align: center;
  flex-shrink: 0;
}
.file-link {
  color: var(--p-primary-color);
  text-decoration: none;
}
.file-link:hover {
  text-decoration: underline;
}
.file-size {
  color: var(--p-text-muted-color);
  margin-left: 0.3rem;
}
.download-btn {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: var(--p-red-500);
  cursor: pointer;
  user-select: none;
}
.select-cell {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.select-cell :deep(.p-checkbox) {
  pointer-events: none;
}
</style>
