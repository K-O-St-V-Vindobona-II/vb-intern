<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import type { Comment } from '@/types/archive'
import { formatDateTime } from '@/utils/formatters'
import archiveService from '@/services/archiveService'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'

const props = defineProps<{
  fileId: number
  comments: Comment[]
  admin?: boolean
}>()

const emit = defineEmits<{
  (e: 'changed'): void
}>()

const toast = useToast()
const confirm = useConfirm()
const dialogVisible = ref(false)
const commentText = ref('')
const saving = ref(false)

const openDialog = () => {
  commentText.value = ''
  dialogVisible.value = true
}

const saveComment = async () => {
  saving.value = true
  try {
    await archiveService.createComment(props.fileId, { content: commentText.value })
    dialogVisible.value = false
    emit('changed')
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: 'Kommentar konnte nicht gespeichert werden.',
      life: 5000,
    })
  } finally {
    saving.value = false
  }
}

const deleteComment = (commentId: number) => {
  confirm.require({
    message: 'Kommentar wirklich löschen?',
    header: 'Bestätigung',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: {
      label: 'Abbrechen',
      severity: 'secondary',
    },
    acceptProps: {
      label: 'Löschen',
      severity: 'danger',
    },
    accept: async () => {
      try {
        await archiveService.deleteComment(props.fileId, commentId)
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
  <div class="file-comments">
    <div v-if="comments.length">
      <h4 class="comments-title">Kommentare</h4>
      <Card v-for="c in comments" :key="c.id" class="comment-card">
        <template #header>
          <div class="comment-header">
            <small class="comment-author"> Kommentar von {{ c.author }} </small>
            <Button
              v-if="admin"
              v-tooltip="'Löschen'"
              icon="pi pi-trash"
              severity="danger"
              text
              size="small"
              @click="deleteComment(c.id)"
            />
          </div>
        </template>
        <template #content>
          <div class="comment-content">
            {{ c.content }}
          </div>
        </template>
        <template #footer>
          <small class="comment-date">
            Erstellt am
            {{ formatDateTime(c.created_at) }}
          </small>
        </template>
      </Card>
    </div>

    <div class="add-comment">
      <Button
        label="Kommentar hinzufügen"
        icon="pi pi-comment"
        severity="primary"
        @click="openDialog"
      />
    </div>

    <Dialog
      v-model:visible="dialogVisible"
      header="Kommentar hinzufügen"
      modal
      :style="{ width: '450px' }"
    >
      <Textarea
        v-model="commentText"
        rows="5"
        style="width: 100%"
        placeholder="Kommentar (5-1000 Zeichen)"
      />
      <template #footer>
        <Button label="Abbrechen" severity="secondary" @click="dialogVisible = false" />
        <Button
          label="Speichern"
          severity="danger"
          :loading="saving"
          :disabled="commentText.length < 5 || commentText.length > 1000"
          @click="saveComment"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.comments-title {
  text-align: center;
  margin: 1.5rem 0 0.75rem;
}
.comment-card {
  margin: 0.5rem auto;
  max-width: 600px;
}
.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem 0;
}
.comment-author {
  color: var(--p-text-muted-color);
}
.comment-content {
  white-space: pre-wrap;
}
.comment-date {
  color: var(--p-text-muted-color);
}
.add-comment {
  text-align: center;
  margin: 1rem 0;
}
</style>
