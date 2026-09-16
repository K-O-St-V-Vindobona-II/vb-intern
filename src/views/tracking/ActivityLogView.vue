<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import activityLogService from '@/services/activityLogService'
import trackingService from '@/services/trackingService'
import type { ActivityDayGroup, IdLabelOption } from '@/types/activityLog'
import Select from 'primevue/select'
import { formatApiError } from '@/utils/formatters'
import { useToast } from 'primevue/usetoast'

const toast = useToast()
const route = useRoute()
const router = useRouter()

const dayGroups = ref<ActivityDayGroup[]>([])
const loading = ref(false)
const retentionMonths = ref(6)

const allMonthNames = [
  '',
  'Jänner',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

const now = new Date()
const cutoffDate = computed(
  () => new Date(now.getFullYear(), now.getMonth() - retentionMonths.value, 1),
)

const validMonths = computed(() => {
  const result: { year: number; month: number; label: string }[] = []
  const d = new Date(cutoffDate.value)
  while (d <= now) {
    result.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${allMonthNames[d.getMonth() + 1]} ${d.getFullYear()}`,
    })
    d.setMonth(d.getMonth() + 1)
  }
  return result.reverse()
})

const initialYear = Number(route.query['year']) || now.getFullYear()
const initialMonth = Number(route.query['month']) || now.getMonth() + 1
const selectedMonth = ref(
  validMonths.value.find((m) => m.year === initialYear && m.month === initialMonth) ??
    validMonths.value[0],
)

const formatDayTitle = (day: string): string => {
  const d = new Date(`${day}T00:00:00`)
  return d.toLocaleDateString('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const fetchDayGroups = async () => {
  if (!selectedMonth.value) {
    dayGroups.value = []
    return
  }
  loading.value = true
  try {
    dayGroups.value = await activityLogService.listDaysWithActivity(
      selectedMonth.value.year,
      selectedMonth.value.month,
    )
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Fehler', detail: formatApiError(e), life: 5000 })
  } finally {
    loading.value = false
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
  try {
    const config = await trackingService.getConfig()
    retentionMonths.value = config.retention_months
  } catch {
    /* fallback to default */
  }
  fetchDayGroups()
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
