<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import p4xService from '@/services/p4xService'
import type { CategoryWithUsage } from '@/types/p4x'
import CategoryLabel from './components/CategoryLabel.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Message from 'primevue/message'

const router = useRouter()
const loading = ref(true)
const loadFailed = ref(false)
const categories = ref<CategoryWithUsage[]>([])

const load = async () => {
  loading.value = true
  loadFailed.value = false
  try {
    const resp = await p4xService.getCategories()
    categories.value = resp.data
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-if="loadFailed" class="load-error">
    <Message severity="error" :closable="false"
      >Die Kategorien konnten nicht geladen werden.</Message
    >
    <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="load" />
  </div>
  <div v-else-if="!loading" class="cat-list">
    <h2>Kategorien</h2>
    <p class="subtitle">Übersicht</p>

    <div class="actions-top">
      <Button label="Kategorie erstellen" @click="router.push({ name: 'p4x-category-new' })" />
    </div>

    <div class="count-label">Kategorien ({{ categories.length }})</div>

    <DataTable :value="categories" size="small" striped-rows scrollable>
      <Column header="" style="width: 3rem">
        <template #body="{ data }">
          <i
            class="pi pi-pencil clickable"
            @click="router.push({ name: 'p4x-category-edit', params: { id: data.id } })"
          />
        </template>
      </Column>
      <Column field="name" header="Name" sortable />
      <Column header="in Filtern / in Direktzuordnung">
        <template #body="{ data }"> {{ data.used.filter }} / {{ data.used.direct }} </template>
      </Column>
      <Column header="Label">
        <template #body="{ data }">
          <CategoryLabel :category="data" direct class="uniform-label" />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.cat-list {
  max-width: 900px;
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
.clickable {
  cursor: pointer;
}
.clickable:hover {
  color: var(--p-primary-600);
}
.uniform-label {
  min-width: 14rem;
  justify-content: center;
}
</style>
