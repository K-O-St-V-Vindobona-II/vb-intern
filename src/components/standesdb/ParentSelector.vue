<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import standesdbService from '@/services/standesdbService'
import InputText from 'primevue/inputtext'
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const props = defineProps<{
  parentId: number
  parentCn: string
  memberId: number | null
  label: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:parentId': [value: number]
  'update:parentCn': [value: string]
}>()

const router = useRouter()

const dialogVisible = ref(false)
const candidateId = ref(0)
const candidateCn = ref('')
const searchQuery = ref('')
const suggestions = ref<{ id: number; cn: string }[]>([])

const openDialog = () => {
  candidateId.value = props.parentId
  candidateCn.value = props.parentCn
  searchQuery.value = ''
  dialogVisible.value = true
}

const onSearch = async (event: { query: string }) => {
  if (event.query.length < 3 || !props.memberId) {
    suggestions.value = []
    return
  }
  try {
    const resp = await standesdbService.searchParent(props.memberId, event.query)
    suggestions.value = resp.data.data
  } catch {
    suggestions.value = []
  }
}

const onSelectCandidate = (event: { value: { id: number; cn: string } }) => {
  candidateId.value = event.value.id
  candidateCn.value = event.value.cn
  searchQuery.value = ''
}

const clearCandidate = () => {
  candidateId.value = 0
  candidateCn.value = ''
}

const save = () => {
  emit('update:parentId', candidateId.value)
  emit('update:parentCn', candidateCn.value)
  dialogVisible.value = false
}

const cancel = () => {
  dialogVisible.value = false
}

const goToParent = () => {
  if (props.parentId) {
    router.push({
      name: 'standesdb-member-show',
      params: { id: props.parentId },
    })
  }
}
</script>

<template>
  <div class="parent-selector">
    <label class="field-label">{{ label }}</label>

    <small v-if="!memberId" class="hint-text">
      (nur auswählbar, wenn Mitglied bereits gespeichert wurde)
    </small>

    <div v-else class="input-row">
      <InputText
        v-if="readonly && parentId"
        :model-value="parentCn"
        readonly
        class="parent-input clickable"
        @click="goToParent"
      />
      <InputText v-else :model-value="parentCn || '–'" readonly disabled class="parent-input" />
      <Button
        v-if="!readonly && memberId"
        icon="pi pi-pencil"
        text
        severity="secondary"
        aria-label="Leibbursch bearbeiten"
        @click="openDialog"
      />
    </div>

    <Dialog
      v-model:visible="dialogVisible"
      header="Leibbursch auswählen"
      modal
      :style="{ width: '450px' }"
      :breakpoints="{ '600px': '95vw' }"
    >
      <div class="dialog-content">
        <AutoComplete
          v-model="searchQuery"
          :suggestions="suggestions"
          option-label="cn"
          placeholder="Name suchen (mind. 3 Zeichen)..."
          :min-length="3"
          :auto-option-focus="true"
          class="w-full"
          fluid
          @complete="onSearch"
          @item-select="onSelectCandidate"
        />

        <div v-if="candidateId" class="current-selection">
          <strong>Aktuelle Auswahl:</strong>
          <span>{{ candidateCn }}</span>
          <Button
            icon="pi pi-trash"
            text
            severity="danger"
            size="small"
            aria-label="Auswahl löschen"
            @click="clearCandidate"
          />
        </div>
        <div v-else class="current-selection">&nbsp;</div>
      </div>

      <template #footer>
        <Button label="Abbrechen" severity="secondary" @click="cancel" />
        <Button label="Ok" @click="save" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.parent-selector {
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
}

.field-label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
  color: var(--p-text-color);
}

.hint-text {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.parent-input {
  flex: 1;
}

.parent-input.clickable {
  cursor: pointer;
  color: var(--p-primary-color);
  text-decoration: underline;
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.current-selection {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  min-height: 2rem;
}

.w-full {
  width: 100%;
}
</style>
