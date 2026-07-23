<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import p4xService from '@/services/p4xService'
import type { P4xCategory, PaginatedTransactions } from '@/types/p4x'
import Amount from './components/Amount.vue'
import TransactionTable from './components/TransactionTable.vue'
import Card from 'primevue/card'
import DatePicker from 'primevue/datepicker'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const accountId = Number(route.params['accountId'])
const loading = ref(true)
const categories = ref<P4xCategory[]>([])
const result = ref<PaginatedTransactions | null>(null)
const selectedDate = ref(new Date(Number(route.params['year']), Number(route.params['month']) - 1))

const year = ref(Number(route.params['year']))
const month = ref(Number(route.params['month']))

const isAdmin = computed(() => authStore.user?.permissions?.includes('p4xAdmin') ?? false)

const load = async (page = 1) => {
  loading.value = true
  try {
    const [txResp, dashResp] = await Promise.all([
      p4xService.getTransactionsByMonth(accountId, year.value, month.value, page),
      categories.value.length ? Promise.resolve(null) : p4xService.getDashboard(),
    ])
    result.value = txResp.data
    if (dashResp) {
      categories.value = dashResp.data.categories
    }
  } finally {
    loading.value = false
  }
}

const onMonthChange = () => {
  const d = selectedDate.value
  year.value = d.getFullYear()
  month.value = d.getMonth() + 1
  router.replace({
    name: 'p4x-transactions-month',
    params: { accountId, year: year.value, month: month.value },
  })
  load()
}

const onPageChange = (page: number) => load(page)

onMounted(() => load())

watch(
  () => route.params,
  () => {
    if (route.params['year'] && route.params['month']) {
      year.value = Number(route.params['year'])
      month.value = Number(route.params['month'])
      selectedDate.value = new Date(year.value, month.value - 1)
      load()
    }
  },
)

const monthLabel = (): string =>
  selectedDate.value.toLocaleDateString('de-AT', { month: 'long', year: 'numeric' })
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
        :manual-input="false"
        :max-date="new Date()"
        @date-select="onMonthChange"
      />
    </div>

    <Card v-if="result && !loading" class="info-card">
      <template #content>
        <div class="info-grid">
          <div class="info-row">
            <span>Monat:</span>
            <span>{{ monthLabel() }}</span>
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
      v-if="result && !loading"
      :transactions="result.items"
      :categories="categories"
      :total="result.total"
      :page="result.page"
      :per-page="result.per_page"
      :admin="isAdmin"
      @page-change="onPageChange"
      @refresh="load(result?.page ?? 1)"
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
