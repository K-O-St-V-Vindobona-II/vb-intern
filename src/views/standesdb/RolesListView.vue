<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import standesdbService from '@/services/standesdbService'
import type { RolesListEntry } from '@/types/standesdb'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import Button from 'primevue/button'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const roles = ref<RolesListEntry[]>([])
const activeSemester = ref('')
const activeYear = ref(0)

const selectedSemester = ref('')
const selectedYear = ref(0)

const semesterOptions = [
  { label: 'Sommersemester', value: 'ss' },
  { label: 'Wintersemester', value: 'ws' },
]

const yearOptions = computed(() => {
  const years: number[] = []
  for (let y = 2100; y >= 1928; y--) {
    years.push(y)
  }
  return years
})

const semLabel = computed(() =>
  activeSemester.value === 'ws' ? 'Wintersemester' : 'Sommersemester',
)

const chcRoles = computed(() => roles.value.filter((r) => r.group === 'chc'))

const philchcRoles = computed(() => roles.value.filter((r) => r.group === 'philchc'))

const funktionRoles = computed(() =>
  roles.value.filter(
    (r) => r.group === 'funktion' || r.group === 'kommission' || r.group === 'verbindungsgericht',
  ),
)

const groupLabel = (group: string | null) => {
  const labels: Record<string, string> = {
    funktion: 'Funktion',
    kommission: 'Kommission',
    verbindungsgericht: 'Verbindungsgericht',
  }
  return labels[group ?? ''] ?? group ?? ''
}

const loadFromRoute = async () => {
  loading.value = true
  const { year, semester } = route.params
  const params =
    year && semester
      ? {
          year: Number(year),
          semester: String(semester),
        }
      : undefined
  try {
    const resp = await standesdbService.getRolesList(params)
    roles.value = resp.data.roles
    activeSemester.value = resp.data.semester
    activeYear.value = resp.data.year
    selectedSemester.value = resp.data.semester
    selectedYear.value = resp.data.year
  } finally {
    loading.value = false
  }
}

const loadCurrent = () => {
  router.push({ name: 'standesdb-roles' })
}

const loadSemester = () => {
  router.push({
    name: 'standesdb-roles-semester',
    params: {
      year: selectedYear.value,
      semester: selectedSemester.value,
    },
  })
}

const goToMember = (id: number) => {
  router.push({
    name: 'standesdb-member-show',
    params: { id },
  })
}

watch(
  () => route.params,
  () => loadFromRoute(),
  { immediate: true },
)
</script>

<template>
  <div class="roles-list">
    <div class="roles-header">
      <h2>Standesdatenbank</h2>
      <p class="roles-subtitle">Liste aller Chargen und Funktionen</p>
    </div>

    <Card class="filter-card">
      <template #content>
        <div class="filter-content">
          <Button label="Aktuelle Vertretung anzeigen" severity="primary" @click="loadCurrent" />

          <div class="filter-divider">oder</div>

          <div class="semester-filter">
            <Select
              v-model="selectedSemester"
              :options="semesterOptions"
              option-label="label"
              option-value="value"
              class="semester-select"
            />
            <Select v-model="selectedYear" :options="yearOptions" class="year-select" />
            <Button label="Semester auswählen" severity="primary" @click="loadSemester" />
          </div>
        </div>
      </template>
    </Card>

    <template v-if="!loading && roles.length > 0">
      <h3 class="semester-heading">{{ semLabel }} {{ activeYear }}</h3>

      <Card>
        <template #title>
          <i class="pi pi-star card-icon" />
          Chargenkabinett
        </template>
        <template #content>
          <DataTable :value="chcRoles" striped-rows size="small" scrollable>
            <Column field="label" header="Bezeichnung" />
            <Column header="K.Ö.St.V. Vindobona II">
              <template #body="{ data }">
                <a v-if="data.vbw" class="member-link" @click.prevent="goToMember(data.vbw.id)">
                  {{ data.vbw.cn }}
                </a>
              </template>
            </Column>
            <Column header="K.Ö.St.V. Vindobona nova">
              <template #body="{ data }">
                <a v-if="data.vbn" class="member-link" @click.prevent="goToMember(data.vbn.id)">
                  {{ data.vbn.cn }}
                </a>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <Card class="roles-card">
        <template #title>
          <i class="pi pi-star-fill card-icon" />
          Philister-Chargenkabinett
        </template>
        <template #content>
          <DataTable :value="philchcRoles" striped-rows size="small" scrollable>
            <Column field="label" header="Bezeichnung" />
            <Column header="K.Ö.St.V. Vindobona II">
              <template #body="{ data }">
                <a v-if="data.vbw" class="member-link" @click.prevent="goToMember(data.vbw.id)">
                  {{ data.vbw.cn }}
                </a>
              </template>
            </Column>
            <Column header="K.Ö.St.V. Vindobona nova">
              <template #body="{ data }">
                <a v-if="data.vbn" class="member-link" @click.prevent="goToMember(data.vbn.id)">
                  {{ data.vbn.cn }}
                </a>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <Card class="roles-card">
        <template #title>
          <i class="pi pi-users card-icon" />
          Funktionen, Kommissionen, Gericht
        </template>
        <template #content>
          <DataTable :value="funktionRoles" striped-rows size="small" scrollable>
            <Column field="label" header="Bezeichnung" />
            <Column header="Typ">
              <template #body="{ data }">
                {{ groupLabel(data.group) }}
              </template>
            </Column>
            <Column header="K.Ö.St.V. Vindobona II">
              <template #body="{ data }">
                <a v-if="data.vbw" class="member-link" @click.prevent="goToMember(data.vbw.id)">
                  {{ data.vbw.cn }}
                </a>
              </template>
            </Column>
            <Column header="K.Ö.St.V. Vindobona nova">
              <template #body="{ data }">
                <a v-if="data.vbn" class="member-link" @click.prevent="goToMember(data.vbn.id)">
                  {{ data.vbn.cn }}
                </a>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </template>
  </div>
</template>

<style scoped>
.roles-list {
  max-width: 900px;
  margin: 0 auto;
}

.roles-header {
  margin-bottom: 1rem;
}

.roles-subtitle {
  color: var(--p-text-muted-color);
  margin: 0;
}

.filter-card {
  margin-bottom: 1rem;
}

.filter-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.filter-divider {
  color: var(--p-text-muted-color);
}

.semester-filter {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  width: 100%;
}

.semester-select,
.year-select {
  width: 100%;
}

.semester-heading {
  text-align: center;
  margin: 1.5rem 0;
}

.roles-card {
  margin-top: 1rem;
}

.card-icon {
  color: var(--p-primary-color);
  margin-right: 0.3rem;
}

.member-link {
  color: var(--p-primary-color);
  cursor: pointer;
  text-decoration: none;
}

.member-link:hover {
  text-decoration: underline;
}

@media (min-width: 768px) {
  .semester-filter {
    flex-direction: row;
    width: auto;
  }
  .semester-select {
    width: auto;
    min-width: 180px;
  }
  .year-select {
    width: auto;
    min-width: 100px;
  }
}
</style>
