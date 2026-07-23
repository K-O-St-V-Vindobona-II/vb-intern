<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import p4xService from '@/services/p4xService'
import type { CategoryFilter, P4xCategory, PaginatedTransactions } from '@/types/p4x'
import TransactionTable from './components/TransactionTable.vue'
import Select from 'primevue/select'

const route = useRoute()
const accountId = Number(route.params['accountId'])

const loading = ref(false)
const categories = ref<P4xCategory[]>([])
const filters = ref<CategoryFilter[]>([])
const selectedFilterId = ref<number | null>(null)
const result = ref<PaginatedTransactions | null>(null)

const loadTransactions = async (page = 1) => {
  if (!selectedFilterId.value) return
  loading.value = true
  try {
    const resp = await p4xService.getTransactionsByFilter(accountId, selectedFilterId.value, page)
    result.value = resp.data
  } finally {
    loading.value = false
  }
}

const onFilterChange = () => {
  result.value = null
  loadTransactions()
}

const onPageChange = (page: number) => loadTransactions(page)

onMounted(async () => {
  const [fResp, dResp] = await Promise.all([
    p4xService.getCategoryFilters(),
    p4xService.getDashboard(),
  ])
  filters.value = fResp.data.filter((f) => f.p4x_account_id === accountId)
  categories.value = dResp.data.categories

  const queryFilterId = Number(route.query['filterId'])
  if (queryFilterId && filters.value.some((f) => f.id === queryFilterId)) {
    selectedFilterId.value = queryFilterId
    loadTransactions()
  }
})

const filterOptions = () => filters.value.map((f) => ({ label: f.name, value: f.id }))
</script>

<template>
  <div class="tx-filter-view">
    <div class="page-header">
      <h2>AH-Kassen</h2>
      <p class="subtitle">Transaktionen nach Filter</p>
    </div>

    <div class="center-block">
      <div class="search-container">
        <Select
          v-model="selectedFilterId"
          :options="filterOptions()"
          option-label="label"
          option-value="value"
          placeholder="Filter wählen..."
          class="w-full"
          @change="onFilterChange"
        />
      </div>
    </div>

    <TransactionTable
      v-if="result && !loading"
      :transactions="result.items"
      :categories="categories"
      :total="result.total"
      :page="result.page"
      :per-page="result.per_page"
      admin
      @page-change="onPageChange"
      @refresh="loadTransactions(result?.page ?? 1)"
    />

    <div class="back-link">
      <router-link :to="{ name: 'p4x-dashboard' }"> Zurück zur Kontenübersicht </router-link>
    </div>
  </div>
</template>

<style scoped>
.tx-filter-view {
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
.search-container {
  width: 100%;
}
.w-full {
  width: 100%;
}
@media (min-width: 640px) {
  .search-container {
    max-width: 400px;
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
