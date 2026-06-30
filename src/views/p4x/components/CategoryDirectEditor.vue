<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { P4xTransaction, P4xCategory } from '@/types/p4x'
import p4xService from '@/services/p4xService'
import CategoryLabel from './CategoryLabel.vue'
import FormAmount from './FormAmount.vue'
import Amount from './Amount.vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Select from 'primevue/select'

const props = defineProps<{
  transaction: P4xTransaction
  categories: P4xCategory[]
}>()
const emit = defineEmits<{ changed: [tx: P4xTransaction] }>()

const router = useRouter()
const visible = ref(false)
const loading = ref(false)
const expandedFilters = ref<Set<number>>(new Set())

const form = ref({
  cat0: null as number | null,
  amt0: 0,
  cat1: null as number | null,
  amt1: 0,
  cat2: null as number | null,
  amt2: 0,
})

const categoryOptions = computed(() =>
  [...props.categories]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ label: `${c.name} (${c.label})`, value: c.id })),
)

const formSum = computed(() => form.value.amt0 + form.value.amt1 + form.value.amt2)

const isValid = computed(() => {
  const tx = props.transaction
  if (form.value.amt0 !== 0 && !form.value.cat0) return false
  if (form.value.amt1 !== 0 && !form.value.cat1) return false
  if (form.value.amt2 !== 0 && !form.value.cat2) return false
  if (tx.amount > 0 && (form.value.amt0 < 0 || form.value.amt1 < 0 || form.value.amt2 < 0))
    return false
  if (tx.amount < 0 && (form.value.amt0 > 0 || form.value.amt1 > 0 || form.value.amt2 > 0))
    return false
  return Number(formSum.value) === Number(tx.amount)
})

const open = () => {
  const d = props.transaction.p4x_category_directs
  form.value = {
    cat0: d[0]?.p4x_category_id ?? null,
    amt0: d[0] ? Number(d[0].amount) : props.transaction.amount,
    cat1: d[1]?.p4x_category_id ?? null,
    amt1: d[1] ? Number(d[1].amount) : 0,
    cat2: d[2]?.p4x_category_id ?? null,
    amt2: d[2] ? Number(d[2].amount) : 0,
  }
  expandedFilters.value.clear()
  visible.value = true
}

const save = async () => {
  loading.value = true
  try {
    const resp = await p4xService.setCategoryDirect(props.transaction.id, [
      { p4x_category_id: form.value.cat0, amount: form.value.amt0 },
      { p4x_category_id: form.value.cat1, amount: form.value.amt1 },
      { p4x_category_id: form.value.cat2, amount: form.value.amt2 },
    ])
    emit('changed', resp.data as P4xTransaction)
    visible.value = false
  } finally {
    loading.value = false
  }
}

const deleteDirect = async () => {
  loading.value = true
  try {
    const resp = await p4xService.unsetCategoryDirect(props.transaction.id)
    emit('changed', resp.data as P4xTransaction)
    visible.value = false
  } finally {
    loading.value = false
  }
}

const toggleDetails = (filterId: number) => {
  if (expandedFilters.value.has(filterId)) {
    expandedFilters.value.delete(filterId)
  } else {
    expandedFilters.value.add(filterId)
  }
}

const subjectModeLabel = (mode: string): string => {
  if (mode === 'starts') return 'beginnt mit:'
  if (mode === 'contains') return 'enthält:'
  return 'lautet:'
}

const navigateToFilterEdit = (filterId: number) => {
  visible.value = false
  router.push({ name: 'p4x-filter-edit', params: { id: filterId } })
}

const navigateToFilter2Direct = (filterId: number) => {
  visible.value = false
  router.push({ name: 'p4x-filter2direct', params: { id: filterId } })
}

const navigateToFilterCreate = () => {
  visible.value = false
  const tx = props.transaction
  router.push({
    name: 'p4x-filter-new',
    query: {
      accountId: tx.p4x_account_id,
      iban: tx.iban || undefined,
      amount: tx.amount,
      subject: tx.subject || undefined,
    },
  })
}

defineExpose({ open })
</script>

<template>
  <Dialog v-model:visible="visible" header="Kategorisierung!" :modal="true" style="width: 45rem">
    <div class="filter-section">
      <h4>Filter</h4>

      <template v-if="transaction.p4x_category_filters.length">
        <div class="filter-header">
          Kategorie-Filter ({{ transaction.p4x_category_filters.length }}):
        </div>
        <table class="filter-table">
          <thead>
            <tr>
              <th />
              <th>Treffer</th>
              <th>Filtername</th>
              <th>Kategorie</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="f in transaction.p4x_category_filters" :key="f.id">
              <tr>
                <td class="icon-cell">
                  <i
                    class="pi pi-info-circle icon-btn"
                    title="Details"
                    @click="toggleDetails(f.id)"
                  />
                  <i
                    class="pi pi-pencil icon-btn"
                    title="bearbeiten"
                    @click="navigateToFilterEdit(f.id)"
                  />
                  <i
                    class="pi pi-hammer icon-btn"
                    title="Treffer zu Direktkategorisierung umwandeln"
                    @click="navigateToFilter2Direct(f.id)"
                  />
                </td>
                <td>{{ f.hitCount }}</td>
                <td>{{ f.name }}</td>
                <td>
                  <CategoryLabel :category="categories.find((c) => c.id === f.p4x_category_id)" />
                </td>
              </tr>
              <tr v-if="expandedFilters.has(f.id)">
                <td colspan="4" class="details-cell">
                  <div class="filter-details">
                    <div v-if="f.name"><strong>Filtername:</strong> {{ f.name }}</div>
                    <div v-if="f.p4x_account_label">Konto: {{ f.p4x_account_label }}</div>
                    <div v-if="f.iban">IBAN (Gegenstelle): {{ f.iban }}</div>
                    <div v-if="f.min_amount !== null">
                      Minimalbetrag: <Amount :amount="f.min_amount" />
                    </div>
                    <div v-if="f.max_amount !== null">
                      Maximalbetrag: <Amount :amount="f.max_amount" />
                    </div>
                    <div v-if="f.subject !== null && f.subject_mode">
                      Betreff {{ subjectModeLabel(f.subject_mode) }}
                      <pre class="subject-value"><code>{{ f.subject }}</code></pre>
                    </div>
                    <div>
                      <CategoryLabel
                        :category="categories.find((c) => c.id === f.p4x_category_id)"
                      />
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </template>

      <template v-else>
        <Button
          label="Filter erstellen"
          severity="success"
          size="small"
          @click="navigateToFilterCreate"
        />
      </template>

      <hr />
    </div>

    <h4>Direkt-Kategorisierung</h4>

    <div v-for="idx in 3" :key="idx" class="slot-row">
      <span class="slot-num">{{ idx }}</span>
      <Select
        v-model="form[`cat${idx - 1}` as keyof typeof form]"
        :options="categoryOptions"
        option-label="label"
        option-value="value"
        placeholder="Kategorie wählen..."
        class="slot-select"
      />
      <FormAmount v-model="form[`amt${idx - 1}` as keyof typeof form] as number" />
    </div>

    <div class="sum-row">Summe: <Amount :amount="transaction.amount" /></div>

    <template #footer>
      <Button label="Speichern" :disabled="!isValid" @click="save" />
      <Button label="Löschen" severity="danger" @click="deleteDirect" />
      <Button label="Schließen" severity="secondary" @click="visible = false" />
    </template>
  </Dialog>
</template>

<style scoped>
.filter-section {
  margin-bottom: 1rem;
}
.filter-header {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.filter-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}
.filter-table th {
  text-align: left;
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--p-surface-200);
  font-weight: 600;
}
.filter-table td {
  padding: 0.3rem 0.5rem;
  vertical-align: middle;
}
.icon-cell {
  white-space: nowrap;
}
.icon-btn {
  cursor: pointer;
  margin-right: 0.4rem;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}
.icon-btn:hover {
  color: var(--p-primary-color);
}
.details-cell {
  padding: 0 0.5rem 0.5rem !important;
}
.filter-details {
  background: var(--p-surface-100);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  line-height: 1.6;
}
.subject-value {
  display: inline-block;
  margin: 0.2rem 0;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--p-surface-300);
  border-radius: 4px;
  background: var(--p-surface-0);
  font-size: 0.85rem;
}
.slot-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.slot-num {
  width: 1.5rem;
  text-align: center;
  font-weight: 500;
}
.slot-select {
  flex: 1;
}
.sum-row {
  text-align: right;
  margin: 0.5rem 0 1rem;
  font-weight: 500;
}
</style>
