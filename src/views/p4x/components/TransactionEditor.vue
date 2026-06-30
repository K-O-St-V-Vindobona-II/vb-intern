<script setup lang="ts">
import { ref } from 'vue'
import type { P4xTransaction } from '@/types/p4x'
import p4xService from '@/services/p4xService'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import FileUpload from 'primevue/fileupload'

const props = defineProps<{ transaction: P4xTransaction }>()
const emit = defineEmits<{ changed: [tx: P4xTransaction] }>()

const visible = ref(false)
const comment = ref('')
const deleteAttachment = ref(false)
const selectedFile = ref<File | null>(null)
const loading = ref(false)

const open = () => {
  comment.value = props.transaction.comment ?? ''
  deleteAttachment.value = false
  selectedFile.value = null
  visible.value = true
}

const onFileSelect = (event: { files: File[] }) => {
  selectedFile.value = event.files[0] ?? null
}

const save = async () => {
  loading.value = true
  try {
    const formData = new FormData()
    formData.append('comment', comment.value || '')
    formData.append('delete_attachment', String(deleteAttachment.value))
    if (selectedFile.value) {
      formData.append('file', selectedFile.value)
    }
    const resp = await p4xService.updateTransaction(props.transaction.id, formData)
    emit('changed', resp.data as P4xTransaction)
    visible.value = false
  } finally {
    loading.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <Dialog
    v-model:visible="visible"
    header="Kommentar und Anhang bearbeiten"
    :modal="true"
    style="width: 35rem"
  >
    <div class="field">
      <label class="field-label">Kommentar</label>
      <Textarea v-model="comment" rows="3" class="w-full" :maxlength="250" />
    </div>

    <div v-if="transaction.has_attachment" class="field">
      <label class="field-label">Vorhandener Anhang</label>
      <div>
        <Button
          :label="deleteAttachment ? 'Löschen rückgängig' : 'Anhang löschen'"
          :severity="deleteAttachment ? 'secondary' : 'danger'"
          size="small"
          @click="deleteAttachment = !deleteAttachment"
        />
      </div>
    </div>

    <div v-if="!transaction.has_attachment" class="field">
      <label class="field-label">PDF-Anhang hochladen</label>
      <FileUpload
        mode="basic"
        accept=".pdf"
        :max-file-size="3145728"
        choose-label="PDF auswählen"
        :auto="false"
        @select="onFileSelect"
      />
    </div>

    <template #footer>
      <Button label="Speichern" :loading="loading" @click="save" />
      <Button label="Abbrechen" severity="secondary" @click="visible = false" />
    </template>
  </Dialog>
</template>

<style scoped>
.field {
  margin-bottom: 1rem;
}
.field-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.3rem;
}
.w-full {
  width: 100%;
}
</style>
