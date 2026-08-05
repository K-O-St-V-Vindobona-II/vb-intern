<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { formatApiError } from '@/utils/formatters'
import { quotesService } from '@/services/publicContentService'
import type { QuoteResponse } from '@/services/publicContentService'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'

const toast = useToast()

const loading = ref(true)
const quotes = ref<QuoteResponse[]>([])

const newQuote = ref('')
const newAuthor = ref('')
const adding = ref(false)

const editDialogVisible = ref(false)
const editQuoteId = ref(0)
const editQuoteText = ref('')
const editAuthor = ref('')

const deleteDialogVisible = ref(false)
const deleteQuoteId = ref(0)

const loadQuotes = async () => {
  loading.value = true
  try {
    const resp = await quotesService.list()
    quotes.value = resp.data
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Zitate konnten nicht geladen werden.'),
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}

const addQuote = async () => {
  if (!newQuote.value.trim() || !newAuthor.value.trim()) return
  adding.value = true
  try {
    await quotesService.create({ quote: newQuote.value, author: newAuthor.value })
    newQuote.value = ''
    newAuthor.value = ''
    await loadQuotes()
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Zitat hinzugefügt.',
      life: 3000,
    })
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Hinzufügen fehlgeschlagen.'),
      life: 5000,
    })
  } finally {
    adding.value = false
  }
}

const moveQuote = async (quote: QuoteResponse, direction: 'up' | 'down') => {
  try {
    await quotesService.move(quote.id, direction)
    await loadQuotes()
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Verschieben fehlgeschlagen.'),
      life: 5000,
    })
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
      quote: editQuoteText.value,
      author: editAuthor.value,
    })
    editDialogVisible.value = false
    await loadQuotes()
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Änderungen gespeichert.',
      life: 3000,
    })
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Speichern fehlgeschlagen.'),
      life: 5000,
    })
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
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Löschen fehlgeschlagen.'),
      life: 5000,
    })
  }
}

onMounted(loadQuotes)
</script>

<template>
  <div class="quotes-admin">
    <template v-if="!loading">
      <div class="page-header">
        <h2 class="page-title">www-Administration</h2>
        <h3 class="page-subtitle">Zitate</h3>
      </div>

      <div class="add-section">
        <label class="section-label">Neues Zitat</label>
        <div class="add-row">
          <InputText v-model="newQuote" placeholder="Zitat" maxlength="500" class="add-quote" />
          <InputText v-model="newAuthor" placeholder="Urheber" maxlength="100" class="add-author" />
          <Button
            label="Hinzufügen"
            icon="pi pi-plus"
            size="small"
            :loading="adding"
            :disabled="!newQuote.trim() || !newAuthor.trim()"
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
              :disabled="index === 0"
              aria-label="Nach oben verschieben"
              @click="moveQuote(quote, 'up')"
            />
            <Button
              icon="pi pi-arrow-down"
              text
              size="small"
              :disabled="index === quotes.length - 1"
              aria-label="Nach unten verschieben"
              @click="moveQuote(quote, 'down')"
            />
            <Button
              label="Bearbeiten"
              icon="pi pi-pencil"
              text
              size="small"
              @click="openEdit(quote)"
            />
            <Button
              label="Löschen"
              icon="pi pi-trash"
              text
              size="small"
              severity="danger"
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
          <Button label="Speichern" @click="saveEdit" />
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

.section-label {
  display: block;
  font-weight: 700;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.add-section {
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  background: var(--p-surface-0);
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
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  padding: 0.9rem;
  background: var(--p-surface-0);
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
