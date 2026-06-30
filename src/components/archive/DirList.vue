<script setup lang="ts">
import { toRef } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useArchiveStore } from '@/stores/archive'
import { useShiftSelect } from '@/composables/useShiftSelect'
import type { DirShort } from '@/types/archive'
import { formatDate } from '@/utils/formatters'
import archiveService from '@/services/archiveService'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'

const props = defineProps<{
  items: DirShort[]
  title: string
  admin?: boolean
  trash?: boolean
}>()

const emit = defineEmits<{
  (e: 'changed'): void
}>()

const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const store = useArchiveStore()
const { isSelected, toggle, toggleAll, allSelected, selectedItems, deselectAll } =
  useShiftSelect<DirShort>(toRef(props, 'items'), (d) => d.id)

const goToDir = (id: number) => {
  router.push({
    name: 'archive-dir',
    params: { id },
  })
}

const copyToClipboard = () => {
  const items = selectedItems.value.map((d) => `dir:${d.id}`)
  store.addToClipboard(items)
  deselectAll()
}

const toggleTrash = (dir: DirShort, isTrash: boolean) => {
  confirm.require({
    message: isTrash ? 'Verzeichnis wiederherstellen?' : 'Verzeichnis wirklich löschen?',
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
          await archiveService.restoreDir(dir.id)
        } else {
          await archiveService.deleteDir(dir.id)
        }
        emit('changed')
      } catch {
        toast.add({
          severity: 'error',
          summary: 'Fehler',
          life: 3000,
        })
      }
    },
  })
}
</script>

<template>
  <div v-if="items.length" class="dir-list">
    <div class="list-header">
      <strong>{{ title }} ({{ items.length }})</strong>
      <Button
        v-if="admin && !trash"
        v-tooltip="'In Zwischenablage'"
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
    <DataTable :value="items" striped-rows size="small" scrollable>
      <Column v-if="admin && !trash" style="width: 2.5rem; min-width: 2.5rem; max-width: 2.5rem">
        <template #header>
          <div class="select-cell" @click.prevent="toggleAll()">
            <Checkbox :model-value="allSelected" :binary="true" />
          </div>
        </template>
        <template #body="{ index, data }">
          <div class="select-cell" @click="toggle(index, $event)">
            <Checkbox :model-value="isSelected(data)" :binary="true" />
          </div>
        </template>
      </Column>
      <Column field="name" header="Name" sortable>
        <template #body="{ data }">
          <a v-if="!trash" class="dir-link" @click.prevent="goToDir(data.id)">
            <i class="pi pi-folder folder-icon" />
            {{ data.name }}
          </a>
          <span v-else>
            <i class="pi pi-folder folder-icon" />
            {{ data.name }}
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
.dir-list {
  margin: 1rem 0;
}
.dir-list :deep(td),
.dir-list :deep(th) {
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
.dir-link {
  color: var(--p-primary-color);
  cursor: pointer;
  text-decoration: none;
}
.dir-link:hover {
  text-decoration: underline;
}
.folder-icon {
  margin-right: 0.4rem;
  color: var(--p-yellow-600);
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
