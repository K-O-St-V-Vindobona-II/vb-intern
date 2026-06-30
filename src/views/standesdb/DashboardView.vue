<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import standesdbService from '@/services/standesdbService'
import type { Stats, SearchResult } from '@/types/standesdb'
import PersonSearchField from '@/components/PersonSearchField.vue'
import type { SearchResult as GenericSearchResult } from '@/components/PersonSearchField.vue'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const stats = ref<Stats | null>(null)

const hasPermission = (perm: string) => authStore.user?.permissions?.includes(perm) ?? false

const canCreateMember = hasPermission('standesdbVbwAdmin') || hasPermission('standesdbVbnAdmin')
const canCreateContact = hasPermission('standesdbContactAdmin')

onMounted(async () => {
  try {
    const resp = await standesdbService.getStats()
    stats.value = resp.data
  } finally {
    loading.value = false
  }
})

const searchStandesdb = async (query: string): Promise<GenericSearchResult[]> => {
  const resp = await standesdbService.search(query)
  return resp.data.data
}

const onSelectResult = (item: GenericSearchResult) => {
  const typed = item as unknown as SearchResult
  if (typed.type === 'member') {
    router.push({
      name: 'standesdb-member-show',
      params: { id: typed.id },
    })
  } else {
    router.push({
      name: 'standesdb-contact-show',
      params: { id: typed.id },
    })
  }
}

const orgIds = computed(() => {
  if (!stats.value) return []
  return Object.keys(stats.value.member.present)
})

const memberRows = () => {
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
}
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
          <PersonSearchField
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

    <template v-if="!loading && stats">
      <Card>
        <template #title> Mitglieder </template>
        <template #content>
          <DataTable :value="memberRows()" striped-rows size="small">
            <Column field="label" header="Status" />
            <Column v-for="org in orgIds" :key="org" :field="org" :header="org.toUpperCase()" />
          </DataTable>
        </template>
      </Card>

      <Card style="margin-top: 1rem">
        <template #title> Kontakte </template>
        <template #content>
          <DataTable
            :value="[
              {
                label: 'Allgemein',
                count: stats.contact.common,
              },
              {
                label: 'VBW',
                count: stats.contact.vbw,
              },
              {
                label: 'VBN',
                count: stats.contact.vbn,
              },
            ]"
            striped-rows
            size="small"
          >
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
