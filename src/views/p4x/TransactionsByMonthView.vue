<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePaginatedTransactions } from '@/composables/usePaginatedTransactions'
import p4xService from '@/services/p4xService'
import type { P4xCategory } from '@/types/p4x'
import Amount from './components/Amount.vue'
import TransactionTable from './components/TransactionTable.vue'
import Card from 'primevue/card'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import Message from 'primevue/message'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const accountId = computed(() => String(route.params['accountId']))
const year = computed(() => Number(route.params['year']))
const month = computed(() => Number(route.params['month']))

const maxDate = new Date()
const selectedDate = ref(new Date(year.value, month.value - 1))
const categories = ref<P4xCategory[]>([])

const isAdmin = computed(() => authStore.user?.permissions?.includes('p4xAdmin') ?? false)

const monthLabel = computed(() =>
  new Date(year.value, month.value - 1).toLocaleDateString('de-AT', {
    month: 'long',
    year: 'numeric',
  }),
)

const selection = computed(() => ({
  accountId: accountId.value,
  year: year.value,
  month: month.value,
}))

const loadCategories = async () => {
  if (categories.value.length > 0) return
  const dashResp = await p4xService.getDashboard()
  categories.value = dashResp.data.categories
}

const { result, loadFailed, load, reload } = usePaginatedTransactions(
  selection,
  async (key, page) => {
    const [txResp] = await Promise.all([
      p4xService.getTransactionsByMonth(key.accountId, key.year, key.month, page),
      loadCategories(),
    ])
    return txResp
  },
)

const onMonthChange = () => {
  router.replace({
    name: 'p4x-transactions-month',
    params: {
      accountId: accountId.value,
      year: selectedDate.value.getFullYear(),
      month: selectedDate.value.getMonth() + 1,
    },
  })
}

const onPageChange = (page: number) => load(page)

watch(
  [accountId, year, month],
  ([, newYear, newMonth]) => {
    if (Number.isNaN(newYear) || Number.isNaN(newMonth)) return
    selectedDate.value = new Date(newYear, newMonth - 1)
    load()
  },
  { immediate: true },
)
</script>

<template>
  <div class="tx-month-view">
    <div class="page-header">
      <h2>AH-Kassen</h2>
      <p class="subtitle">
        {{ result?.items?.[0]?.p4x_account_cn || 'Konto' }}
      </p>
    </div>

    <div class="center-block">
      <DatePicker
        v-model="selectedDate"
        view="month"
        date-format="MM yy"
        aria-label="Monat wählen"
        :manual-input="false"
        :max-date="maxDate"
        @date-select="onMonthChange"
      />
    </div>

    <Message v-if="loadFailed" severity="error" :closable="false" class="load-error">
      Transaktionen konnten nicht geladen werden.
      <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="reload" />
    </Message>

    <Card v-if="result" class="info-card">
      <template #content>
        <div class="info-grid">
          <div class="info-row">
            <span>Monat:</span>
            <span>{{ monthLabel }}</span>
          </div>
          <div class="info-row">
            <span>Kontostand zum Monatsersten:</span>
            <Amount :amount="result.startbalance ?? 0" />
          </div>
          <div class="info-row">
            <span>Kontostand zum Monatsletzten:</span>
            <Amount :amount="result.endbalance ?? 0" />
          </div>
        </div>
      </template>
    </Card>

    <TransactionTable
      v-if="result"
      :transactions="result.items"
      :categories="categories"
      :total="result.total"
      :page="result.page"
      :per-page="result.per_page"
      :admin="isAdmin"
      @page-change="onPageChange"
      @refresh="reload"
    />

    <div class="back-link">
      <router-link :to="{ name: 'p4x-dashboard' }"> Zurück zur Kontenübersicht </router-link>
    </div>
  </div>
</template>

<style scoped>
.tx-month-view {
  max-width: 1100px;
  margin: 0 auto;
}
.page-header {
  text-align: center;
  margin-bottom: 1rem;
}
.subtitle {
  color: var(--p-primary-600);
  margin: 0;
}
.center-block {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}
.load-error {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}
.info-card {
  margin: 0 auto 1.5rem;
}
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.info-row {
  display: flex;
  justify-content: space-between;
}
@media (min-width: 640px) {
  .info-card {
    max-width: 600px;
  }
}
.back-link {
  text-align: center;
  margin-top: 2rem;
}
.back-link a {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  text-decoration: none;
}
.back-link a:hover {
  text-decoration: underline;
}
</style>
