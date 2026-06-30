<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { P4xTransaction, P4xCategory } from '@/types/p4x'
import p4xService from '@/services/p4xService'
import Amount from './Amount.vue'
import CategoryLabel from './CategoryLabel.vue'
import PartnerLabel from './PartnerLabel.vue'
import WarningLabel from './WarningLabel.vue'
import TransactionEditor from './TransactionEditor.vue'
import CategoryDirectEditor from './CategoryDirectEditor.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

const props = defineProps<{
  transactions: P4xTransaction[]
  categories: P4xCategory[]
  title?: string
  total?: number
  page?: number
  perPage?: number
  admin?: boolean
}>()

const emit = defineEmits<{
  pageChange: [page: number]
  refresh: []
}>()

const expandedRows = ref({})
const rawDialogVisible = ref(false)
const rawData = ref<object | null>(null)

const txEditorRef = ref<InstanceType<typeof TransactionEditor> | null>(null)
const catEditorRef = ref<InstanceType<typeof CategoryDirectEditor> | null>(null)
const editingTx = ref<P4xTransaction | null>(null)

const findCategory = (id: number): P4xCategory | undefined =>
  props.categories.find((c) => c.id === id)

const showRaw = async (tx: P4xTransaction) => {
  try {
    const resp = await p4xService.getTransactionRaw(tx.p4x_account_id, tx.id)
    rawData.value = JSON.parse(resp.data.raw)
    rawDialogVisible.value = true
  } catch {
    rawData.value = null
  }
}

const downloadAttachment = async (tx: P4xTransaction) => {
  try {
    const resp = await p4xService.getTransactionAttachment(tx.p4x_account_id, tx.id)
    const url = window.URL.createObjectURL(new Blob([resp.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Beilage_${tx.id}.pdf`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch {
    /* empty */
  }
}

const formatDate = (d: string | null): string => {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' })
}

const directionLabel = (amount: number): { text: string; cls: string } => {
  if (amount === 0) return { text: 'intern', cls: 'dir-neutral' }
  return amount > 0
    ? { text: 'Absender', cls: 'dir-positive' }
    : { text: 'Empfänger', cls: 'dir-negative' }
}

const totalPages = props.total && props.perPage ? Math.ceil(props.total / props.perPage) : 1

const openTxEditor = async (tx: P4xTransaction) => {
  editingTx.value = tx
  await nextTick()
  txEditorRef.value?.open()
}

const openCatEditor = async (tx: P4xTransaction) => {
  editingTx.value = tx
  await nextTick()
  catEditorRef.value?.open()
}

const onTxChanged = () => {
  emit('refresh')
}
</script>

<template>
  <div class="tx-table-wrapper">
    <div v-if="title" class="tx-title">
      {{ title }}
    </div>

    <div v-if="transactions.length === 0" class="tx-empty">Keine Transaktionen vorhanden</div>

    <template v-else>
      <div v-if="total && perPage && page" class="tx-pagination">
        <span class="tx-count">{{ total }} Transaktionen gefunden</span>
        <div class="tx-pager">
          <Button
            icon="pi pi-angle-double-left"
            text
            size="small"
            :disabled="page <= 1"
            @click="emit('pageChange', 1)"
          />
          <Button
            icon="pi pi-angle-left"
            text
            size="small"
            :disabled="page <= 1"
            @click="emit('pageChange', page - 1)"
          />
          <span class="page-info">Seite {{ page }} / {{ totalPages }}</span>
          <Button
            icon="pi pi-angle-right"
            text
            size="small"
            :disabled="page >= totalPages"
            @click="emit('pageChange', page + 1)"
          />
          <Button
            icon="pi pi-angle-double-right"
            text
            size="small"
            :disabled="page >= totalPages"
            @click="emit('pageChange', totalPages)"
          />
        </div>
        <small class="tx-range">
          Transaktionen {{ (page - 1) * perPage + 1 }} bis {{ Math.min(page * perPage, total) }}
        </small>
      </div>

      <DataTable
        v-model:expanded-rows="expandedRows"
        :value="transactions"
        data-key="id"
        size="small"
        striped-rows
        scrollable
        scroll-height="flex"
      >
        <Column expander style="width: 3rem" />

        <Column header="" style="width: 2rem">
          <template #body="{ data }">
            <i
              v-if="data.has_attachment"
              v-tooltip="'Anhang herunterladen'"
              class="pi pi-paperclip clickable"
              @click="downloadAttachment(data)"
            />
          </template>
        </Column>

        <Column field="booking" header="Buchungsdatum" sortable>
          <template #body="{ data }">
            {{ formatDate(data.booking) }}
          </template>
        </Column>

        <Column header="Partner">
          <template #body="{ data }">
            <small :class="directionLabel(data.amount).cls">
              {{ directionLabel(data.amount).text }}
            </small>
            <div v-if="data.partner">
              <PartnerLabel :partner="data.partner" :delegating-partner="data.delegating_partner" />
            </div>
            <WarningLabel v-else label="Kein Partner gesetzt!" />
          </template>
        </Column>

        <Column header="Kategorie" style="min-width: 14rem">
          <template #body="{ data }">
            <div class="category-cell">
              <i
                v-if="admin"
                v-tooltip="'Kategorisierung bearbeiten'"
                class="pi pi-pencil clickable category-edit-icon"
                @click="openCatEditor(data)"
              />
              <div class="category-badges">
                <template v-if="data.p4x_category_directs.length">
                  <div v-for="d in data.p4x_category_directs" :key="d.id">
                    <CategoryLabel
                      :category="findCategory(d.p4x_category_id)"
                      :amount="data.p4x_category_directs.length > 1 ? d.amount : null"
                      direct
                    />
                  </div>
                </template>
                <template v-else-if="data.p4x_category_filters.length === 1">
                  <CategoryLabel
                    :category="findCategory(data.p4x_category_filters[0].p4x_category_id)"
                  />
                </template>
                <template v-else-if="data.p4x_category_filters.length > 1">
                  <div v-for="f in data.p4x_category_filters" :key="f.id">
                    <CategoryLabel :category="findCategory(f.p4x_category_id)" />
                  </div>
                  <WarningLabel label="Uneindeutige Kategorie-Filter!" />
                </template>
                <WarningLabel v-else label="Keine Kategorie!" />
              </div>
            </div>
          </template>
        </Column>

        <Column header="Betrag" style="text-align: right">
          <template #body="{ data }">
            <div style="text-align: right">
              <Amount :amount="data.amount" />
            </div>
          </template>
        </Column>

        <template #expansion="{ data: tx }">
          <div class="tx-detail">
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Konto:</span>
                <span>{{ tx.p4x_account_cn }} ({{ tx.p4x_account_iban }})</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">IBAN:</span>
                <span>{{ tx.iban }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Betreff:</span>
                <span>{{ tx.subject }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Wertstellung:</span>
                <span>{{ formatDate(tx.valuation) }}</span>
              </div>
              <div v-if="tx.comment" class="detail-item">
                <span class="detail-label">Kommentar:</span>
                <span style="white-space: pre-line">{{ tx.comment }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Rohdaten</span>
                <span>
                  <i class="pi pi-search clickable" @click="showRaw(tx)" />
                </span>
              </div>
            </div>
            <div v-if="admin" class="detail-admin-link">
              <span class="clickable admin-action" @click="openTxEditor(tx)">
                [ Kommentar und Anhang bearbeiten ]
              </span>
            </div>
          </div>
        </template>
      </DataTable>
    </template>

    <!-- Dialogs -->
    <Dialog
      v-model:visible="rawDialogVisible"
      header="Rohdaten"
      :modal="true"
      :style="{ width: '50rem', maxWidth: '95vw', maxHeight: '80vh' }"
    >
      <pre v-if="rawData" class="raw-json">{{ JSON.stringify(rawData, null, 2) }}</pre>
    </Dialog>

    <TransactionEditor
      v-if="editingTx && admin"
      ref="txEditorRef"
      :transaction="editingTx"
      @changed="onTxChanged"
    />

    <CategoryDirectEditor
      v-if="editingTx && admin"
      ref="catEditorRef"
      :transaction="editingTx"
      :categories="categories"
      @changed="onTxChanged"
    />
  </div>
</template>

<style scoped>
.tx-table-wrapper {
  margin-top: 1rem;
}
.tx-table-wrapper :deep(td),
.tx-table-wrapper :deep(th) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tx-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
  text-align: center;
}
.tx-empty {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  text-align: center;
}
.tx-pagination {
  text-align: center;
  margin-bottom: 1.25rem;
}
.tx-count {
  font-weight: 600;
  display: block;
  margin-bottom: 0.5rem;
}
.tx-pager {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.page-info {
  margin: 0 0.5rem;
  font-size: 0.85rem;
}
.tx-range {
  display: block;
  margin-top: 0.35rem;
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}
.clickable {
  cursor: pointer;
}
.clickable:hover {
  color: var(--p-primary-600);
}
.dir-positive {
  color: var(--p-green-600, #16a34a);
}
.dir-negative {
  color: var(--p-red-600, #dc2626);
}
.dir-neutral {
  color: var(--p-text-muted-color);
}
.category-cell {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  width: 100%;
}
.category-edit-icon {
  flex-shrink: 0;
  margin-top: 0.15rem;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}
.category-badges {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}
.category-badges :deep(.category-badge) {
  display: flex;
  width: 100%;
  box-sizing: border-box;
}
.tx-detail {
  padding: 0.5rem 0.75rem;
}
.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.detail-label {
  font-weight: 600;
  white-space: nowrap;
  min-width: unset;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}
.detail-admin-link {
  margin-top: 0.5rem;
}
.admin-action {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}
.admin-action:hover {
  color: var(--p-primary-600);
}
.raw-json {
  font-size: 0.8rem;
  max-height: 60vh;
  overflow: auto;
  background: var(--p-surface-50);
  padding: 1rem;
  border-radius: 6px;
}

@media (min-width: 640px) {
  .detail-item {
    flex-direction: row;
    gap: 0.5rem;
  }
  .detail-label {
    min-width: 6rem;
    font-size: inherit;
    color: inherit;
  }
}
</style>
