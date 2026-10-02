<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useToast } from 'primevue/usetoast'
import type { Sets } from '@/types/archive'
import archiveService from '@/services/archiveService'
import { formatApiError } from '@/utils/formatters'
import PermissionGrid from './PermissionGrid.vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'

const props = defineProps<{
  sets: Sets
  create?: boolean
  parentId?: string | null
  dirId?: string
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

// Same rule the API applies to a directory name (surrounding whitespace is
// stripped, then 3-64 characters), so an invalid name is caught before the
// request instead of coming back as a generic failure.
const NAME_MIN_LENGTH = 3
const NAME_MAX_LENGTH = 64
const trimmedName = computed(() => name.value.trim())
const isNameValid = computed(
  () => trimmedName.value.length >= NAME_MIN_LENGTH && trimmedName.value.length <= NAME_MAX_LENGTH,
)
const showNameError = computed(() => trimmedName.value !== '' && !isNameValid.value)

const fieldId = useId()
const nameId = `${fieldId}-name`
const nameHintId = `${fieldId}-name-hint`
const descriptionId = `${fieldId}-description`

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

interface DirPayload {
  name: string
  description: string | null
  permissions: string[]
  recursive_permissions: boolean
}

const persist = (payload: DirPayload) => {
  if (props.create) {
    return archiveService.createDir({ ...payload, parentId: props.parentId || null })
  }
  if (!props.dirId) {
    throw new Error('DirEditor needs a dirId unless it is used to create a directory')
  }
  return archiveService.updateDir(props.dirId, payload)
}

const save = async () => {
  if (!isNameValid.value) return
  saving.value = true
  try {
    await persist({
      name: trimmedName.value,
      description: description.value || null,
      permissions: permissions.value,
      recursive_permissions: recursive.value,
    })
    visible.value = false
    emit('saved')
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      life: 2000,
    })
  } catch (err) {
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
      aria-label="Verzeichnis bearbeiten"
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
        <label :for="nameId">Name</label>
        <InputText
          :id="nameId"
          v-model="name"
          class="w-full"
          :maxlength="NAME_MAX_LENGTH"
          :invalid="showNameError"
          :aria-describedby="nameHintId"
        />
        <small :id="nameHintId" :class="showNameError ? 'field-error' : 'field-hint'">
          {{ NAME_MIN_LENGTH }} bis {{ NAME_MAX_LENGTH }} Zeichen
        </small>

        <label :for="descriptionId">Beschreibung</label>
        <InputText :id="descriptionId" v-model="description" class="w-full" />

        <span class="field-label">Berechtigungen</span>
        <PermissionGrid v-model="permissions" :orgs="sets.orgs" :states="sets.states" edit />

        <label class="recursive-label">
          <Checkbox v-model="recursive" :binary="true" />
          <span>Berechtigungen rekursiv</span>
        </label>
      </div>

      <template #footer>
        <Button label="Abbrechen" severity="secondary" @click="visible = false" />
        <Button
          label="Speichern"
          severity="danger"
          :loading="saving"
          :disabled="!isNameValid"
          @click="save"
        />
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
.field-hint {
  color: var(--p-text-muted-color);
}
.field-error {
  color: var(--p-red-500);
}
.recursive-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}
</style>
