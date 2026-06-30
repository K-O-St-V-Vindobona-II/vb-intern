<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useArchiveStore } from '@/stores/archive'
import archiveService from '@/services/archiveService'
import Button from 'primevue/button'

const props = defineProps<{
  targetDirId: number
}>()

const emit = defineEmits<{
  (e: 'moved'): void
}>()

const toast = useToast()
const confirm = useConfirm()
const store = useArchiveStore()

const dirs = computed(() => store.clipboard.filter((i) => i.startsWith('dir:')))
const files = computed(() => store.clipboard.filter((i) => i.startsWith('file:')))

const idsFromItems = (items: string[]) => items.map((i) => Number(i.split(':')[1]))

const moveItems = (type: string, items: string[]) => {
  const label = type === 'dir' ? 'Verzeichnisse' : 'Dateien'
  confirm.require({
    message: `${items.length} ${label} hierher verschieben?`,
    header: 'Bestätigung',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: {
      label: 'Abbrechen',
      severity: 'secondary',
    },
    acceptProps: {
      label: 'Verschieben',
      severity: 'primary',
    },
    accept: async () => {
      try {
        const ids = idsFromItems(items)
        const data = { type, ids, action: 'move' }
        if (props.targetDirId) {
          await archiveService.receiveItems(props.targetDirId, data)
        } else {
          await archiveService.receiveItemsRoot(data)
        }
        store.removeFromClipboard(items)
        emit('moved')
        toast.add({
          severity: 'success',
          summary: 'Verschoben',
          life: 2000,
        })
      } catch {
        toast.add({
          severity: 'error',
          summary: 'Fehler',
          detail: 'Verschieben fehlgeschlagen.',
          life: 5000,
        })
      }
    },
  })
}
</script>

<template>
  <div v-if="store.clipboard.length" class="clipboard-bar">
    <div class="clipboard-header">
      <Button
        v-tooltip="'Zwischenablage leeren'"
        icon="pi pi-times"
        severity="secondary"
        text
        size="small"
        @click="store.emptyClipboard()"
      />
      <strong>Zwischenablage</strong>
    </div>
    <div v-if="dirs.length" class="clipboard-row">
      <span>Verzeichnisse: {{ dirs.length }}</span>
      <Button
        v-tooltip="'Hierher verschieben'"
        icon="pi pi-arrow-right"
        severity="primary"
        text
        size="small"
        @click="moveItems('dir', dirs)"
      />
    </div>
    <div v-if="files.length" class="clipboard-row">
      <span>Dateien: {{ files.length }}</span>
      <Button
        v-tooltip="'Hierher verschieben'"
        icon="pi pi-arrow-right"
        severity="primary"
        text
        size="small"
        @click="moveItems('file', files)"
      />
    </div>
  </div>
</template>

<style scoped>
.clipboard-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  z-index: 1000;
  padding: 0.5rem 0.75rem;
  background: var(--p-surface-100);
  border: 1px solid var(--p-primary-color);
  border-radius: 0 8px 0 0;
  font-size: 0.85rem;
}
.clipboard-header {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.clipboard-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid var(--p-surface-300);
  padding-top: 0.25rem;
  margin-top: 0.25rem;
}
</style>
