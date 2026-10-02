<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import activityLogService from '@/services/activityLogService'
import { useTrackingRetention, type RetentionMonth } from '@/composables/useTrackingRetention'
import type { ActivityDayGroup, IdLabelOption } from '@/types/activityLog'
import Select from 'primevue/select'
import { formatApiError } from '@/utils/formatters'
import { useToast } from 'primevue/usetoast'

const toast = useToast()
const route = useRoute()
const router = useRouter()

const dayGroups = ref<ActivityDayGroup[]>([])
const loading = ref(false)

const { months, loadRetention } = useTrackingRetention()
const validMonths = computed(() => [...months.value].reverse())

// The month is resolved only after the configured retention is known: the
// month of a deep link (e.g. the way back from a day view) may lie beyond the
// default window, and resolving it earlier would silently fall back to the
// current month.
const selectedMonth = ref<RetentionMonth>()
const queryYear = Number(route.query['year'])
const queryMonth = Number(route.query['month'])

const resolveInitialMonth = (): RetentionMonth | undefined =>
  validMonths.value.find((m) => m.year === queryYear && m.month === queryMonth) ??
  validMonths.value[0]

const formatDayTitle = (day: string): string => {
  const d = new Date(`${day}T00:00:00`)
  return d.toLocaleDateString('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Answers arrive in any order: a slow answer for the month selected before
// must not replace the days of the month on screen.
let latestDayGroupsRequestId = 0

const fetchDayGroups = async () => {
  const requestId = ++latestDayGroupsRequestId
  if (!selectedMonth.value) {
    dayGroups.value = []
    loading.value = false
    return
  }
  loading.value = true
  try {
    const groups = await activityLogService.listDaysWithActivity(
      selectedMonth.value.year,
      selectedMonth.value.month,
    )
    if (requestId !== latestDayGroupsRequestId) return
    dayGroups.value = groups
  } catch (e) {
    if (requestId !== latestDayGroupsRequestId) return
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
  } finally {
    if (requestId === latestDayGroupsRequestId) loading.value = false
  }
}

const goToMember = (day: string, member: IdLabelOption) => {
  router.push({
    name: 'tracking-activity-member',
    params: { memberId: member.id },
    query: { day },
  })
}

watch(selectedMonth, (m) => {
  if (m) {
    router.replace({ query: { year: m.year, month: m.month } })
  }
  fetchDayGroups()
})

onMounted(async () => {
  await loadRetention()
  selectedMonth.value = resolveInitialMonth()
})
</script>

<template>
  <div>
    <h2>Aktivitätsprotokoll</h2>

    <div class="month-select">
      <Select
        v-model="selectedMonth"
        :options="validMonths"
        option-label="label"
        placeholder="Monat wählen"
      />
    </div>

    <div v-if="dayGroups.length === 0 && !loading" class="empty-state">
      Keine Aktivität in diesem Monat.
    </div>

    <div class="day-groups">
      <div v-for="group in dayGroups" :key="group.day" class="day-card">
        <div class="day-title">{{ formatDayTitle(group.day) }}</div>
        <ul class="member-list">
          <li v-for="member in group.members" :key="member.id">
            <button type="button" class="member-link" @click="goToMember(group.day, member)">
              {{ member.label }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.month-select {
  margin-bottom: 1rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--p-text-muted-color);
}

.day-groups {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.day-card {
  border: 1px solid var(--app-border-card);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  background: var(--app-surface-card);
}

.day-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.member-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.member-link {
  background: none;
  border: none;
  padding: 0.3rem 0.25rem;
  text-align: left;
  color: var(--p-primary-color);
  cursor: pointer;
  font-size: 0.95rem;
  width: 100%;
  border-radius: 6px;
}

.member-link:hover {
  background-color: var(--app-surface-subtle);
}

@media (min-width: 768px) {
  .member-list {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .member-link {
    width: auto;
  }
}
</style>
