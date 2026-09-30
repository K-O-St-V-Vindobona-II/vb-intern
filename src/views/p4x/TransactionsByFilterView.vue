<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { usePaginatedTransactions } from '@/composables/usePaginatedTransactions'
import p4xService from '@/services/p4xService'
import type { CategoryFilter, P4xCategory } from '@/types/p4x'
import TransactionTable from './components/TransactionTable.vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Message from 'primevue/message'

const route = useRoute()
const accountId = String(route.params['accountId'])

const setupFailed = ref(false)
const categories = ref<P4xCategory[]>([])
const filters = ref<CategoryFilter[]>([])
const selectedFilterId = ref<string | null>(null)

const { result, loadFailed, load, reload } = usePaginatedTransactions(
  selectedFilterId,
  (filterId, page) => p4xService.getTransactionsByFilter(accountId, filterId, page),
)

const onFilterChange = () => load()

const onPageChange = (page: number) => load(page)

const loadSetup = async () => {
  setupFailed.value = false
  try {
    const [fResp, dResp] = await Promise.all([
      p4xService.getCategoryFilters(),
      p4xService.getDashboard(),
    ])
    filters.value = fResp.data.filter((f) => f.p4x_account_id === accountId)
    categories.value = dResp.data.categories
  } catch {
    setupFailed.value = true
    return
  }

  const queryFilterId = route.query['filterId']
  if (typeof queryFilterId === 'string' && filters.value.some((f) => f.id === queryFilterId)) {
    selectedFilterId.value = queryFilterId
    load()
  }
}

onMounted(loadSetup)

const filterOptions = () => filters.value.map((f) => ({ label: f.name, value: f.id }))
</script>

<template>
  <div class="tx-filter-view">
    <div class="page-header">
      <h2>AH-Kassen</h2>
      <p class="subtitle">Transaktionen nach Filter</p>
    </div>

    <Message v-if="setupFailed" severity="error" :closable="false" class="load-error">
      Filter konnten nicht geladen werden.
      <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="loadSetup" />
    </Message>

    <div v-else class="center-block">
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

    <Message v-if="loadFailed" severity="error" :closable="false" class="load-error">
      Transaktionen konnten nicht geladen werden.
      <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="reload" />
    </Message>

    <TransactionTable
      v-if="result"
      :transactions="result.items"
      :categories="categories"
      :total="result.total"
      :page="result.page"
      :per-page="result.per_page"
      admin
      @page-change="onPageChange"
      @refresh="reload"
    />

    <div class="back-link">
      <router-link :to="{ name: 'p4x-dashboard' }"> Zurück zur Kontenübersicht </router-link>
    </div>
  </div>
</template>

<style scoped>
.load-error {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}
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
