<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePermission } from '@/composables/usePermission'
import standesdbService from '@/services/standesdbService'
import type { Stats, SearchResult } from '@/types/standesdb'
import SearchField from '@/components/SearchField.vue'
import type { SearchResult as GenericSearchResult } from '@/components/SearchField.vue'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Message from 'primevue/message'

const router = useRouter()
const { hasPermission } = usePermission()

const loading = ref(true)
const loadFailed = ref(false)
const stats = ref<Stats | null>(null)

const canCreateMember = computed(
  () => hasPermission('standesdbVbwAdmin') || hasPermission('standesdbVbnAdmin'),
)
const canCreateContact = computed(() => hasPermission('standesdbContactAdmin'))

const loadStats = async () => {
  loading.value = true
  loadFailed.value = false
  try {
    const resp = await standesdbService.getStats()
    stats.value = resp.data
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)

const searchStandesdb = async (query: string): Promise<GenericSearchResult[]> => {
  const resp = await standesdbService.search(query)
  return resp.data.data
}

const isStandesdbResult = (item: GenericSearchResult): item is SearchResult =>
  item['type'] === 'member' || item['type'] === 'contact'

const onSelectResult = (item: GenericSearchResult) => {
  if (!isStandesdbResult(item)) return
  router.push({
    name: item.type === 'member' ? 'standesdb-member-show' : 'standesdb-contact-show',
    params: { id: item.id },
  })
}

const orgIds = computed(() => {
  if (!stats.value) return []
  return Object.keys(stats.value.member.present)
})

const memberRows = computed(() => {
  if (!stats.value) return []
  const s = stats.value.member
  const categories: { key: keyof typeof s; label: string }[] = [
    { key: 'present', label: 'Aktiv' },
    { key: 'dismissed', label: 'Entlassen' },
    { key: 'dead', label: 'Verstorben' },
    { key: 'dismissed_dead', label: 'Entl. & Verst.' },
  ]
  return categories.map((cat) => {
    const row: Record<string, string | number> = { label: cat.label }
    for (const org of orgIds.value) {
      row[org] = s[cat.key][org] ?? 0
    }
    return row
  })
})

const contactRows = computed(() => {
  if (!stats.value) return []
  const c = stats.value.contact
  return [
    { label: 'Allgemein', count: c.common },
    { label: 'VBW', count: c.vbw },
    { label: 'VBN', count: c.vbn },
  ]
})
</script>

<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h2>Standesdatenbank</h2>
      <p class="dashboard-subtitle">Mitglieder und Kontakte verwalten</p>
    </div>

    <Card class="search-card">
      <template #content>
        <div class="search-row">
          <SearchField
            :search-fn="searchStandesdb"
            placeholder="Mitglied oder Kontakt suchen (mind. 3 Zeichen)..."
            class="search-input"
            @select="onSelectResult"
          />
          <div class="action-buttons">
            <Button
              v-if="canCreateMember"
              label="Neues Mitglied"
              icon="pi pi-user-plus"
              severity="success"
              size="small"
              @click="
                router.push({
                  name: 'standesdb-member-new',
                })
              "
            />
            <Button
              v-if="canCreateContact"
              label="Neuer Kontakt"
              icon="pi pi-plus"
              severity="info"
              size="small"
              @click="
                router.push({
                  name: 'standesdb-contact-new',
                })
              "
            />
          </div>
        </div>
      </template>
    </Card>

    <div v-if="loadFailed" class="load-error">
      <Message severity="error" :closable="false">
        Die Statistik konnte nicht geladen werden.
      </Message>
      <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="loadStats" />
    </div>

    <template v-else-if="!loading && stats">
      <Card>
        <template #title> Mitglieder </template>
        <template #content>
          <DataTable :value="memberRows" striped-rows size="small">
            <Column field="label" header="Status" />
            <Column v-for="org in orgIds" :key="org" :field="org" :header="org.toUpperCase()" />
          </DataTable>
        </template>
      </Card>

      <Card style="margin-top: 1rem">
        <template #title> Kontakte </template>
        <template #content>
          <DataTable :value="contactRows" striped-rows size="small">
            <Column field="label" header="Kategorie" />
            <Column field="count" header="Anzahl" />
          </DataTable>
        </template>
      </Card>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 900px;
  margin: 0 auto;
}

.dashboard-header {
  margin-bottom: 1rem;
}

.dashboard-subtitle {
  color: var(--p-text-muted-color);
  margin: 0;
}

.search-card {
  margin-bottom: 1rem;
}

.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.search-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.search-input {
  flex: 1;
  min-width: 100%;
}

.search-input :deep(input) {
  width: 100%;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  width: 100%;
}

.action-buttons .p-button {
  flex: 1;
}

@media (min-width: 768px) {
  .search-input {
    min-width: 250px;
  }
  .action-buttons {
    width: auto;
  }
  .action-buttons .p-button {
    flex: none;
  }
}
</style>
