<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import p4xService from '@/services/p4xService'
import type { P4xCategory, PaginatedTransactions } from '@/types/p4x'
import TransactionTable from './components/TransactionTable.vue'
import CategoryLabel from './components/CategoryLabel.vue'
import Card from 'primevue/card'
import Select from 'primevue/select'

const route = useRoute()
const authStore = useAuthStore()
const accountId = Number(route.params.accountId)

const loading = ref(false)
const categories = ref<P4xCategory[]>([])
const allCategories = ref<P4xCategory[]>([])
const selectedCategoryId = ref<number | null>(null)
const selectedCategory = ref<P4xCategory | null>(null)
const result = ref<PaginatedTransactions | null>(null)

const isAdmin = computed(() => authStore.user?.permissions?.includes('p4xAdmin') ?? false)

const loadTransactions = async (page = 1) => {
  if (!selectedCategoryId.value) return
  loading.value = true
  try {
    const resp = await p4xService.getTransactionsByCategory(
      accountId,
      selectedCategoryId.value,
      page,
    )
    result.value = resp.data
    selectedCategory.value =
      allCategories.value.find((c) => c.id === selectedCategoryId.value) ?? null
  } finally {
    loading.value = false
  }
}

const onCategoryChange = () => {
  result.value = null
  loadTransactions()
}

const onPageChange = (page: number) => loadTransactions(page)

onMounted(async () => {
  const dashResp = await p4xService.getDashboard()
  allCategories.value = dashResp.data.categories
  categories.value = dashResp.data.categories
})
</script>

<template>
  <div class="tx-category-view">
    <div class="page-header">
      <h2>AH-Kassen</h2>
      <p class="subtitle">Transaktionen nach Kategorie</p>
    </div>

    <div class="center-block">
      <div class="search-container">
        <Select
          v-model="selectedCategoryId"
          :options="categories"
          option-label="name"
          option-value="id"
          placeholder="Kategorie wählen..."
          class="w-full"
          @change="onCategoryChange"
        />
      </div>
    </div>

    <Card v-if="selectedCategory" class="info-card">
      <template #content>
        <div class="info-grid">
          <div class="info-row">
            <span><strong>Name:</strong> {{ selectedCategory.name }}</span>
          </div>
          <div class="info-row">
            <strong>Label:</strong>
            <CategoryLabel :category="selectedCategory" />
          </div>
        </div>
      </template>
    </Card>

    <TransactionTable
      v-if="result && !loading"
      :transactions="result.items"
      :categories="allCategories"
      :total="result.total"
      :page="result.page"
      :per-page="result.per_page"
      :admin="isAdmin"
      @page-change="onPageChange"
      @refresh="loadTransactions(result?.page ?? 1)"
    />

    <div class="back-link">
      <router-link :to="{ name: 'p4x-dashboard' }"> Zurück zur Kontenübersicht </router-link>
    </div>
  </div>
</template>

<style scoped>
.tx-category-view {
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
.info-card {
  margin: 0 auto 1.5rem;
}
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}
.info-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
@media (min-width: 640px) {
  .search-container {
    max-width: 400px;
  }
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
