<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import type { Sets } from '@/types/archive'
import archiveService from '@/services/archiveService'
import PermissionGrid from './PermissionGrid.vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'

const props = defineProps<{
  sets: Sets
  create?: boolean
  parentId?: number
  dirId?: number
  dirName?: string
  dirDescription?: string | null
  dirPermissions?: string[]
  dirRecursive?: boolean
}>()

const emit = defineEmits<{
  (e: 'saved'): void
}>()

const toast = useToast()
const visible = ref(false)
const saving = ref(false)

const name = ref('')
const description = ref('')
const permissions = ref<string[]>([])
const recursive = ref(false)

const open = () => {
  if (props.create) {
    name.value = ''
    description.value = ''
    permissions.value = []
    recursive.value = false
  } else {
    name.value = props.dirName || ''
    description.value = props.dirDescription || ''
    permissions.value = [...(props.dirPermissions || [])]
    recursive.value = props.dirRecursive || false
  }
  visible.value = true
}

const save = async () => {
  saving.value = true
  try {
    const payload = {
      name: name.value,
      description: description.value || null,
      permissions: permissions.value,
      recursive_permissions: recursive.value,
    }
    if (props.create) {
      await archiveService.createDir({
        ...payload,
        parentId: props.parentId || null,
      })
    } else if (props.dirId) {
      await archiveService.updateDir(props.dirId, payload)
    }
    visible.value = false
    emit('saved')
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      life: 2000,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: 'Speichern fehlgeschlagen.',
      life: 5000,
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <Button
      v-if="create"
      label="Verzeichnis erstellen"
      icon="pi pi-plus"
      severity="primary"
      @click="open"
    />
    <Button
      v-else
      v-tooltip="'Bearbeiten'"
      icon="pi pi-pencil"
      severity="secondary"
      text
      rounded
      size="small"
      @click="open"
    />

    <Dialog
      v-model:visible="visible"
      :header="create ? 'Verzeichnis erstellen' : 'Verzeichnis bearbeiten'"
      modal
      :style="{ width: '500px' }"
      :breakpoints="{ '600px': '95vw' }"
    >
      <div class="editor-form">
        <label>Name</label>
        <InputText v-model="name" class="w-full" />

        <label>Beschreibung</label>
        <InputText v-model="description" class="w-full" />

        <label>Berechtigungen</label>
        <PermissionGrid v-model="permissions" :orgs="sets.orgs" :states="sets.states" edit />

        <label class="recursive-label">
          <Checkbox v-model="recursive" :binary="true" />
          <span>Berechtigungen rekursiv</span>
        </label>
      </div>

      <template #footer>
        <Button label="Abbrechen" severity="secondary" @click="visible = false" />
        <Button label="Speichern" severity="danger" :loading="saving" @click="save" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.editor-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.recursive-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}
</style>
