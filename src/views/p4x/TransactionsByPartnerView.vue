<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import p4xService from '@/services/p4xService'
import type { P4xCategory, PaginatedTransactions, PartnerSearchResult } from '@/types/p4x'
import TransactionTable from './components/TransactionTable.vue'
import PersonSearchField from '@/components/PersonSearchField.vue'
import type { SearchResult } from '@/components/PersonSearchField.vue'
import Card from 'primevue/card'

const route = useRoute()
const authStore = useAuthStore()
const accountId = Number(route.params['accountId'])

const loading = ref(false)
const categories = ref<P4xCategory[]>([])
const result = ref<PaginatedTransactions | null>(null)
const selectedPartner = ref<PartnerSearchResult | null>(null)

const isAdmin = computed(() => authStore.user?.permissions?.includes('p4xAdmin') ?? false)

const searchPartners = async (query: string): Promise<SearchResult[]> => {
  const resp = await p4xService.searchPartners(query)
  return resp.data
}

const onPartnerSelect = async (item: SearchResult) => {
  selectedPartner.value = item as PartnerSearchResult
  await loadTransactions()
}

const loadTransactions = async (page = 1) => {
  if (!selectedPartner.value) return
  loading.value = true
  try {
    const resp = await p4xService.getTransactionsByPartner(
      accountId,
      selectedPartner.value.type,
      selectedPartner.value.id,
      page,
    )
    result.value = resp.data
  } finally {
    loading.value = false
  }
}

const onPageChange = (page: number) => loadTransactions(page)

const partnerTypeLabel = (): string => {
  if (!selectedPartner.value) return ''
  return selectedPartner.value.label.split(':')[0] ?? ''
}

const partnerName = (): string => {
  if (!selectedPartner.value) return ''
  return selectedPartner.value.label.split(':').slice(1).join(':').trim()
}

onMounted(async () => {
  const dashResp = await p4xService.getDashboard()
  categories.value = dashResp.data.categories
})
</script>

<template>
  <div class="tx-partner-view">
    <div class="page-header">
      <h2>AH-Kassen</h2>
      <p class="subtitle">Transaktionen nach Partner</p>
    </div>

    <div class="center-block">
      <div class="search-container">
        <PersonSearchField
          :search-fn="searchPartners"
          placeholder="Partner suchen..."
          @select="onPartnerSelect"
        />
      </div>
    </div>

    <Card v-if="selectedPartner && result && !loading" class="info-card">
      <template #content>
        <div class="info-row">
          <strong>{{ partnerTypeLabel() }}:</strong>
          {{ partnerName() }}
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
      @refresh="loadTransactions(result?.page ?? 1)"
    />

    <div class="back-link">
      <router-link :to="{ name: 'p4x-dashboard' }"> Zurück zur Kontenübersicht </router-link>
    </div>
  </div>
</template>

<style scoped>
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
