<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import p4xService from '@/services/p4xService'
import type { CategoryFilter, P4xCategory } from '@/types/p4x'
import CategoryLabel from './components/CategoryLabel.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'

const router = useRouter()
const loading = ref(true)
const filters = ref<CategoryFilter[]>([])
const categories = ref<P4xCategory[]>([])

const load = async () => {
  loading.value = true
  try {
    const [fResp, dResp] = await Promise.all([
      p4xService.getCategoryFilters(),
      p4xService.getDashboard(),
    ])
    filters.value = fResp.data
    categories.value = dResp.data.categories
  } finally {
    loading.value = false
  }
}

const findCategory = (id: number): P4xCategory | undefined =>
  categories.value.find((c) => c.id === id)

onMounted(load)
</script>

<template>
  <div v-if="!loading" class="filter-list">
    <h2>Kategorie-Filter</h2>
    <p class="subtitle">Übersicht</p>

    <div class="actions-top">
      <Button label="Filter erstellen" @click="router.push({ name: 'p4x-filter-new' })" />
    </div>

    <div class="count-label">Kategorie-Filter ({{ filters.length }})</div>

    <DataTable :value="filters" size="small" striped-rows scrollable>
      <Column header="" style="width: 5rem">
        <template #body="{ data }">
          <div class="icon-group">
            <i v-tooltip="'Details'" class="pi pi-info-circle clickable" />
            <i
              v-tooltip="'Bearbeiten'"
              class="pi pi-pencil clickable"
              @click="router.push({ name: 'p4x-filter-edit', params: { id: data.id } })"
            />
            <i
              v-tooltip="'Filter→Direkt'"
              class="pi pi-hammer clickable"
              @click="router.push({ name: 'p4x-filter2direct', params: { id: data.id } })"
            />
          </div>
        </template>
      </Column>
      <Column field="hitCount" header="Treffer" sortable style="width: 5rem" />
      <Column field="name" header="Filtername" sortable />
      <Column header="Kategorie" style="min-width: 14rem">
        <template #body="{ data }">
          <div class="cat-stretch">
            <CategoryLabel :category="findCategory(data.p4x_category_id)" />
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.filter-list {
  max-width: 1000px;
  margin: 0 auto;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0 0 1rem;
}
.actions-top {
  text-align: center;
  margin-bottom: 1rem;
}
.count-label {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.5rem;
}
.icon-group {
  display: flex;
  gap: 0.4rem;
}
.clickable {
  cursor: pointer;
  color: var(--p-text-muted-color);
}
.clickable:hover {
  color: var(--p-primary-600);
}
.cat-stretch {
  display: flex;
}
.cat-stretch :deep(.category-badge) {
  flex: 1;
}
</style>
