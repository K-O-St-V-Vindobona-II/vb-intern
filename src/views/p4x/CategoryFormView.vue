<script setup lang="ts">
import { formatApiError } from '@/utils/formatters'
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import p4xService from '@/services/p4xService'
import InputText from 'primevue/inputtext'
import ColorPicker from 'primevue/colorpicker'
import Button from 'primevue/button'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const isEdit = computed(() => !!route.params.id)
const loading = ref(true)
const saving = ref(false)

const form = ref({
  name: '',
  label: '',
  background_color: '#336600',
  text_color: '#ffffff',
})

const bgColorHex = computed({
  get: () => form.value.background_color.replace('#', ''),
  set: (v: string) => {
    form.value.background_color = `#${v}`
  },
})

const textColorHex = computed({
  get: () => form.value.text_color.replace('#', ''),
  set: (v: string) => {
    form.value.text_color = `#${v}`
  },
})

onMounted(async () => {
  if (isEdit.value) {
    try {
      const resp = await p4xService.getCategories()
      const cat = resp.data.find((c) => c.id === Number(route.params.id))
      if (cat) {
        form.value = {
          name: cat.name,
          label: cat.label,
          background_color: cat.background_color,
          text_color: cat.text_color,
        }
      }
    } catch {
      /* empty */
    }
  }
  loading.value = false
})

const save = async () => {
  saving.value = true
  try {
    if (isEdit.value) {
      await p4xService.updateCategory(Number(route.params.id), form.value)
      toast.add({ severity: 'success', summary: 'Gespeichert', life: 2000 })
    } else {
      await p4xService.createCategory(form.value)
      toast.add({ severity: 'success', summary: 'Kategorie erstellt', life: 2000 })
    }
    router.push({ name: 'p4x-categories' })
  } catch (e: unknown) {
    const msg = formatApiError(e)
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  } finally {
    saving.value = false
  }
}

const deleteCategory = async () => {
  try {
    await p4xService.deleteCategory(Number(route.params.id))
    toast.add({ severity: 'success', summary: 'Gelöscht', life: 2000 })
    router.push({ name: 'p4x-categories' })
  } catch (e: unknown) {
    const msg = formatApiError(e)
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  }
}
</script>

<template>
  <div v-if="!loading" class="cat-form">
    <h2>Kategorie</h2>
    <p class="subtitle">
      {{ isEdit ? 'Kategorie bearbeiten' : 'Kategorie erstellen' }}
    </p>

    <div class="form-grid">
      <div class="field">
        <label>Name</label>
        <InputText v-model="form.name" :maxlength="64" />
      </div>
      <div class="field">
        <label>Label</label>
        <InputText v-model="form.label" :maxlength="32" />
      </div>
      <div class="color-row">
        <div class="field">
          <label>Hintergrundfarbe</label>
          <div class="color-input">
            <ColorPicker v-model="bgColorHex" />
            <InputText v-model="form.background_color" />
          </div>
        </div>
        <div class="field">
          <label>Textfarbe</label>
          <div class="color-input">
            <ColorPicker v-model="textColorHex" />
            <InputText v-model="form.text_color" />
          </div>
        </div>
      </div>
      <div v-if="form.label" class="preview">
        <label class="preview-label">Vorschau</label>
        <span
          class="preview-badge"
          :style="{
            backgroundColor: form.background_color,
            color: form.text_color,
          }"
        >
          {{ form.label }}
        </span>
      </div>
    </div>

    <div class="actions">
      <Button label="Speichern" :loading="saving" @click="save" />
      <Button v-if="isEdit" label="Löschen" severity="danger" @click="deleteCategory" />
      <Button
        label="Zur Liste"
        severity="secondary"
        @click="router.push({ name: 'p4x-categories' })"
      />
    </div>
  </div>
</template>

<style scoped>
.cat-form {
  max-width: 600px;
  margin: 0 auto;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0 0 1.5rem;
}
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.field label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.3rem;
}
.color-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}
.color-row .field {
  flex: 1;
  min-width: 10rem;
}
.color-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.color-input :deep(.p-inputtext) {
  flex: 1;
}
.preview {
  text-align: center;
  margin-top: 0.5rem;
}
.preview-label {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.4rem;
}
.preview-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  font-weight: 500;
}
.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.5rem;
  justify-content: center;
}
</style>
