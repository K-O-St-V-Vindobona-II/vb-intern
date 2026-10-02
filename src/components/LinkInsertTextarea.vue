<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { insertLink } from '@/composables/useLinkInsertion'

const props = defineProps<{
  modelValue: string
  id?: string
  rows?: number
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// PrimeVue's Textarea has no wrapper element - its single root *is* the
// native <textarea>, so the component ref's `$el` is that DOM node
// directly (needed to read/restore the text selection for link insertion).
const textareaRef = ref<{ $el: HTMLTextAreaElement } | null>(null)

const linkDialogVisible = ref(false)
const linkUrl = ref('')

// Same rule the public site and the API apply to saved text: only http(s)
// links are accepted, anything else is rejected on save. Checking it here
// gives the editor the message while the dialog is still open, instead of a
// failed save later.
const LINK_URL_PATTERN = /^https?:\/\/\S+$/i
const trimmedUrl = computed(() => linkUrl.value.trim())
const isUrlValid = computed(() => LINK_URL_PATTERN.test(trimmedUrl.value))
const showUrlError = computed(() => trimmedUrl.value !== '' && !isUrlValid.value)
const pendingSelection = ref({ start: 0, end: 0 })

const openLinkDialog = () => {
  const el = textareaRef.value?.$el
  if (!el) return
  pendingSelection.value = {
    start: el.selectionStart ?? props.modelValue.length,
    end: el.selectionEnd ?? props.modelValue.length,
  }
  linkUrl.value = ''
  linkDialogVisible.value = true
}

const confirmLink = async () => {
  if (!isUrlValid.value) return

  const { start, end } = pendingSelection.value
  const result = insertLink(props.modelValue, start, end, trimmedUrl.value)
  emit('update:modelValue', result.text)
  linkDialogVisible.value = false

  await nextTick()
  const el = textareaRef.value?.$el
  el?.focus()
  el?.setSelectionRange(result.cursor, result.cursor)
}

const onInput = (value: string | undefined) => {
  emit('update:modelValue', value ?? '')
}

// Falls through to the internal <Textarea>, not this component's own root
// div — otherwise a caller's <label :for="id"> would target a non-focusable
// wrapper instead of the real input.
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="link-insert-textarea">
    <Textarea
      :id="id"
      ref="textareaRef"
      :model-value="modelValue"
      :rows="rows ?? 8"
      :placeholder="placeholder"
      class="w-full"
      v-bind="$attrs"
      @update:model-value="onInput"
    />
    <div class="toolbar">
      <Button
        type="button"
        label="Link einfügen"
        icon="pi pi-link"
        text
        size="small"
        @click="openLinkDialog"
      />
      <span class="toolbar-hint">Text markieren, dann Link einfügen</span>
    </div>

    <Dialog
      v-model:visible="linkDialogVisible"
      header="Link einfügen"
      modal
      :style="{ width: '420px' }"
      :breakpoints="{ '600px': '95vw' }"
    >
      <div class="field">
        <label for="link-insert-url">URL</label>
        <InputText
          id="link-insert-url"
          v-model="linkUrl"
          class="w-full"
          placeholder="https://…"
          autofocus
          :invalid="showUrlError"
          :aria-describedby="showUrlError ? 'link-insert-url-error' : undefined"
          @keyup.enter="confirmLink"
        />
        <small v-if="showUrlError" id="link-insert-url-error" class="field-error" role="alert">
          Die Adresse muss mit http:// oder https:// beginnen.
        </small>
      </div>
      <template #footer>
        <Button label="Abbrechen" severity="secondary" @click="linkDialogVisible = false" />
        <Button label="Einfügen" :disabled="!isUrlValid" @click="confirmLink" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.link-insert-textarea {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.w-full {
  width: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toolbar-hint {
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
}

.field label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
}

.field-error {
  display: block;
  margin-top: 0.25rem;
  color: var(--p-red-500);
}
</style>
