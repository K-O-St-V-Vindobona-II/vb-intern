<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePaginatedTransactions } from '@/composables/usePaginatedTransactions'
import p4xService from '@/services/p4xService'
import type { P4xCategory, PartnerSearchResult } from '@/types/p4x'
import TransactionTable from './components/TransactionTable.vue'
import SearchField from '@/components/SearchField.vue'
import type { SearchResult } from '@/components/SearchField.vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Message from 'primevue/message'

const route = useRoute()
const authStore = useAuthStore()
const accountId = String(route.params['accountId'])

const categoriesLoadFailed = ref(false)
const categories = ref<P4xCategory[]>([])
const selectedPartner = ref<PartnerSearchResult | null>(null)

const { result, loadFailed, load, reload } = usePaginatedTransactions(
  selectedPartner,
  (partner, page) => p4xService.getTransactionsByPartner(accountId, partner.type, partner.id, page),
)

const isAdmin = computed(() => authStore.user?.permissions?.includes('p4xAdmin') ?? false)

const searchPartners = async (query: string): Promise<SearchResult[]> => {
  const resp = await p4xService.searchPartners(query)
  return resp.data
}

const onPartnerSelect = (item: SearchResult) => {
  selectedPartner.value = item as PartnerSearchResult
  return load()
}

const onPageChange = (page: number) => load(page)

const partnerTypeLabel = (): string => {
  if (!selectedPartner.value) return ''
  return selectedPartner.value.label.split(':')[0] ?? ''
}

const partnerName = (): string => {
  if (!selectedPartner.value) return ''
  return selectedPartner.value.label.split(':').slice(1).join(':').trim()
}

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
  <div class="tx-partner-view">
    <div class="page-header">
      <h2>AH-Kassen</h2>
      <p class="subtitle">Transaktionen nach Partner</p>
    </div>

    <Message v-if="categoriesLoadFailed" severity="error" :closable="false" class="load-error">
      Kategorien konnten nicht geladen werden.
      <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="loadCategories" />
    </Message>

    <div class="center-block">
      <div class="search-container">
        <SearchField
          :search-fn="searchPartners"
          placeholder="Partner suchen..."
          @select="onPartnerSelect"
        />
      </div>
    </div>

    <Message v-if="loadFailed" severity="error" :closable="false" class="load-error">
      Transaktionen konnten nicht geladen werden.
      <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="reload" />
    </Message>

    <Card v-if="selectedPartner && result" class="info-card">
      <template #content>
        <div class="info-row">
          <strong>{{ partnerTypeLabel() }}:</strong>
          {{ partnerName() }}
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
.load-error {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}
.tx-partner-view {
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
.info-card {
  margin: 0 auto 1.5rem;
}
.info-row {
  text-align: center;
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
