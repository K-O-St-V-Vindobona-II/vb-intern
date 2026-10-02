<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { formatApiError } from '@/utils/formatters'
import { quotesService } from '@/services/publicContentService'
import type { QuoteResponse } from '@/services/publicContentService'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'

const toast = useToast()

const loading = ref(true)
const loadError = ref(false)
const moving = ref(false)
const quotes = ref<QuoteResponse[]>([])

const newQuote = ref('')
const newAuthor = ref('')
const adding = ref(false)
const canAdd = computed(() => newQuote.value.trim() !== '' && newAuthor.value.trim() !== '')

const editDialogVisible = ref(false)
const editQuoteId = ref('')
const editQuoteText = ref('')
const editAuthor = ref('')
const canSaveEdit = computed(
  () => editQuoteText.value.trim() !== '' && editAuthor.value.trim() !== '',
)

const deleteDialogVisible = ref(false)
const deleteQuoteId = ref('')

const errorToast = (err: unknown, fallback: string) =>
  toast.add({
    severity: 'error',
    summary: 'Fehler',
    detail: formatApiError(err, fallback),
    life: 5000,
  })

// First load and retry: the page is replaced by the spinner while it runs.
const loadQuotes = async () => {
  loading.value = true
  loadError.value = false
  try {
    const resp = await quotesService.list()
    quotes.value = resp.data
  } catch (err: unknown) {
    loadError.value = true
    errorToast(err, 'Zitate konnten nicht geladen werden.')
  } finally {
    loading.value = false
  }
}

// After a change only the list is read again, so the page keeps its scroll
// position and no failed read is mistaken for an empty list.
const refreshQuotes = async () => {
  try {
    const resp = await quotesService.list()
    quotes.value = resp.data
  } catch (err: unknown) {
    errorToast(err, 'Zitate konnten nicht aktualisiert werden.')
  }
}

const addQuote = async () => {
  if (!canAdd.value) return
  adding.value = true
  try {
    await quotesService.create({ quote: newQuote.value.trim(), author: newAuthor.value.trim() })
    newQuote.value = ''
    newAuthor.value = ''
    await refreshQuotes()
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Zitat hinzugefügt.',
      life: 3000,
    })
  } catch (err: unknown) {
    errorToast(err, 'Hinzufügen fehlgeschlagen.')
  } finally {
    adding.value = false
  }
}

const moveQuote = async (quote: QuoteResponse, direction: 'up' | 'down') => {
  moving.value = true
  try {
    await quotesService.move(quote.id, direction)
    await refreshQuotes()
  } catch (err: unknown) {
    errorToast(err, 'Verschieben fehlgeschlagen.')
  } finally {
    moving.value = false
  }
}

const openEdit = (quote: QuoteResponse) => {
  editQuoteId.value = quote.id
  editQuoteText.value = quote.quote
  editAuthor.value = quote.author
  editDialogVisible.value = true
}

const saveEdit = async () => {
  try {
    await quotesService.update(editQuoteId.value, {
      quote: editQuoteText.value.trim(),
      author: editAuthor.value.trim(),
    })
    editDialogVisible.value = false
    await refreshQuotes()
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Änderungen gespeichert.',
      life: 3000,
    })
  } catch (err: unknown) {
    errorToast(err, 'Speichern fehlgeschlagen.')
  }
}

const confirmDelete = (quote: QuoteResponse) => {
  deleteQuoteId.value = quote.id
  deleteDialogVisible.value = true
}

const doDelete = async () => {
  deleteDialogVisible.value = false
  try {
    await quotesService.remove(deleteQuoteId.value)
    quotes.value = quotes.value.filter((q) => q.id !== deleteQuoteId.value)
    toast.add({
      severity: 'success',
      summary: 'Gelöscht',
      detail: 'Zitat entfernt.',
      life: 3000,
    })
  } catch (err: unknown) {
    errorToast(err, 'Löschen fehlgeschlagen.')
  }
}

onMounted(loadQuotes)
</script>

<template>
  <div class="quotes-admin">
    <div v-if="loadError" class="load-error">
      <p>Zitate konnten nicht geladen werden.</p>
      <Button label="Erneut versuchen" icon="pi pi-refresh" @click="loadQuotes" />
    </div>
    <template v-else-if="!loading">
      <div class="page-header">
        <h2 class="page-title">www-Administration</h2>
        <h3 class="page-subtitle">Zitate</h3>
      </div>

      <div class="add-section">
        <label class="section-label">Neues Zitat</label>
        <div class="add-row">
          <InputText
            v-model="newQuote"
            placeholder="Zitat"
            aria-label="Neues Zitat"
            maxlength="500"
            class="add-quote"
          />
          <InputText
            v-model="newAuthor"
            placeholder="Urheber"
            aria-label="Urheber des neuen Zitats"
            maxlength="100"
            class="add-author"
          />
          <Button
            label="Hinzufügen"
            icon="pi pi-plus"
            size="small"
            :loading="adding"
            :disabled="!canAdd"
            @click="addQuote"
          />
        </div>
      </div>

      <div v-if="quotes.length === 0" class="no-quotes">Keine Zitate vorhanden.</div>

      <div class="quote-list">
        <div v-for="(quote, index) in quotes" :key="quote.id" class="quote-card">
          <div class="quote-info">
            <p class="quote-text">„{{ quote.quote }}“</p>
            <p class="quote-author">{{ quote.author }}</p>
          </div>
          <div class="quote-actions">
            <Button
              icon="pi pi-arrow-up"
              text
              size="small"
              :disabled="index === 0 || moving"
              :aria-label="`Nach oben verschieben: ${quote.quote}`"
              @click="moveQuote(quote, 'up')"
            />
            <Button
              icon="pi pi-arrow-down"
              text
              size="small"
              :disabled="index === quotes.length - 1 || moving"
              :aria-label="`Nach unten verschieben: ${quote.quote}`"
              @click="moveQuote(quote, 'down')"
            />
            <Button
              label="Bearbeiten"
              icon="pi pi-pencil"
              text
              size="small"
              :aria-label="`Bearbeiten: ${quote.quote}`"
              @click="openEdit(quote)"
            />
            <Button
              label="Löschen"
              icon="pi pi-trash"
              text
              size="small"
              severity="danger"
              :aria-label="`Löschen: ${quote.quote}`"
              @click="confirmDelete(quote)"
            />
          </div>
        </div>
      </div>

      <Dialog
        v-model:visible="editDialogVisible"
        header="Zitat bearbeiten"
        modal
        :style="{ width: '460px' }"
        :breakpoints="{ '600px': '95vw' }"
      >
        <div class="dialog-fields">
          <div class="field">
            <label for="edit-quote-text">Zitat</label>
            <InputText
              id="edit-quote-text"
              v-model="editQuoteText"
              maxlength="500"
              class="w-full"
            />
          </div>
          <div class="field">
            <label for="edit-quote-author">Urheber</label>
            <InputText id="edit-quote-author" v-model="editAuthor" maxlength="100" class="w-full" />
          </div>
        </div>
        <template #footer>
          <Button label="Abbrechen" severity="secondary" @click="editDialogVisible = false" />
          <Button label="Speichern" :disabled="!canSaveEdit" @click="saveEdit" />
        </template>
      </Dialog>

      <Dialog
        v-model:visible="deleteDialogVisible"
        header="Zitat löschen"
        modal
        :style="{ width: '400px' }"
        :breakpoints="{ '600px': '95vw' }"
      >
        <p>Soll dieses Zitat wirklich gelöscht werden?</p>
        <template #footer>
          <Button label="Abbrechen" severity="secondary" @click="deleteDialogVisible = false" />
          <Button label="Löschen" severity="danger" icon="pi pi-trash" @click="doDelete" />
        </template>
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.quotes-admin {
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.page-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.page-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
}

.page-subtitle {
  margin: 0.25rem 0 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.load-error {
  text-align: center;
  color: var(--p-text-muted-color);
  margin: 3rem 0;
}

.section-label {
  display: block;
  font-weight: 700;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.add-section {
  border: 1px solid var(--app-border-card);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  background: var(--app-surface-card);
}

.add-row {
  display: flex;
  gap: 0.75rem;
  flex-direction: column;
  align-items: stretch;
}

.add-quote {
  flex: 2;
}

.add-author {
  flex: 1;
  min-width: 160px;
}

.no-quotes {
  text-align: center;
  color: var(--p-text-muted-color);
  padding: 2rem;
}

.quote-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.quote-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid var(--app-border-card);
  border-radius: 8px;
  padding: 0.9rem;
  background: var(--app-surface-card);
}

.quote-info {
  flex: 1;
}

.quote-text {
  margin: 0 0 0.35rem;
  font-style: italic;
}

.quote-author {
  margin: 0;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.quote-actions {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.dialog-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-fields .field label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
}

.w-full {
  width: 100%;
}

@media (min-width: 600px) {
  .add-row {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }
}
</style>
