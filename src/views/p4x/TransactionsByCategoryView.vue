<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePaginatedTransactions } from '@/composables/usePaginatedTransactions'
import p4xService from '@/services/p4xService'
import type { P4xCategory } from '@/types/p4x'
import TransactionTable from './components/TransactionTable.vue'
import CategoryLabel from './components/CategoryLabel.vue'
import Card from 'primevue/card'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Message from 'primevue/message'

const route = useRoute()
const authStore = useAuthStore()
const accountId = String(route.params['accountId'])

const categoriesLoadFailed = ref(false)
const categories = ref<P4xCategory[]>([])
const selectedCategoryId = ref<string | null>(null)

const { result, loadFailed, load, reload } = usePaginatedTransactions(
  selectedCategoryId,
  (categoryId, page) => p4xService.getTransactionsByCategory(accountId, categoryId, page),
)

const isAdmin = computed(() => authStore.user?.permissions?.includes('p4xAdmin') ?? false)

const selectedCategory = computed(
  () => categories.value.find((c) => c.id === selectedCategoryId.value) ?? null,
)

const onCategoryChange = () => load()

const onPageChange = (page: number) => load(page)

const loadCategories = async () => {
  categoriesLoadFailed.value = false
  try {
    const dashResp = await p4xService.getDashboard()
    categories.value = dashResp.data.categories
  } catch {
    categoriesLoadFailed.value = true
  }
}

onMounted(loadCategories)
</script>

<template>
  <div class="tx-category-view">
    <div class="page-header">
      <h2>AH-Kassen</h2>
      <p class="subtitle">Transaktionen nach Kategorie</p>
    </div>

    <Message v-if="categoriesLoadFailed" severity="error" :closable="false" class="category-error">
      Kategorien konnten nicht geladen werden.
      <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="loadCategories" />
    </Message>

    <div v-else class="center-block">
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

    <Message v-if="loadFailed" severity="error" :closable="false" class="category-error">
      Transaktionen konnten nicht geladen werden.
      <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="reload" />
    </Message>

    <Card v-if="selectedCategory && result" class="info-card">
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
.category-error {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
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
