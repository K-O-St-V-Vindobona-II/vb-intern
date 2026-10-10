<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import standesdbService from '@/services/standesdbService'
import { formatApiError, formatDateTime, getApiErrorStatus } from '@/utils/formatters'
import type { MemberChangeRequestDetail } from '@/types/standesdb'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import Message from 'primevue/message'

type Decision = 'approved' | 'rejected'

const HTTP_CONFLICT = 409

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(true)
const submitting = ref(false)
const request = ref<MemberChangeRequestDetail | null>(null)
const decisions = ref<Record<string, Decision | null>>({})
let loadRequestId = 0

const decisionOptions = [
  { label: 'Genehmigen', value: 'approved' as const },
  { label: 'Ablehnen', value: 'rejected' as const },
]

const isResolved = computed(() => request.value?.status === 'resolved')
// True only once the member actually resubmitted after the initial
// submission (updated_at moves on every overwrite of the same pending
// row - see submit_change_request()) - avoids showing a redundant second
// "changed at" line with the same timestamp for the common case.
const wasResubmitted = computed(() => {
  const req = request.value
  if (!req) return false
  return req.created_at !== null && req.updated_at !== null && req.updated_at !== req.created_at
})
// The complete decision set, or null while any field is still undecided.
// Checked against the two literal decision values rather than
// "!== undefined": PrimeVue's SelectButton emits null (not undefined) when
// the already-selected option is clicked again to deselect it, which would
// otherwise still count as "decided" and leave the submit button enabled.
const decisionPayload = computed<Record<string, Decision> | null>(() => {
  const current = request.value
  if (!current) return null
  const payload: Record<string, Decision> = {}
  for (const entry of current.diff) {
    const decision = decisions.value[entry.field]
    if (decision !== 'approved' && decision !== 'rejected') return null
    payload[entry.field] = decision
  }
  return payload
})
const allDecided = computed(() => decisionPayload.value !== null)

const decisionTag = (field: string) =>
  decisions.value[field] === 'approved'
    ? { value: 'Genehmigt', severity: 'success' as const }
    : { value: 'Abgelehnt', severity: 'danger' as const }

const setAllDecisions = (decision: Decision) => {
  if (!request.value) return
  request.value.diff.forEach((entry) => {
    decisions.value[entry.field] = decision
  })
}

const applyRequest = (detail: MemberChangeRequestDetail) => {
  request.value = detail
  decisions.value = {}
  Object.entries(detail.field_decisions ?? {}).forEach(([field, decision]) => {
    if (decision === 'approved' || decision === 'rejected') {
      decisions.value[field] = decision
    }
  })
}

const loadRequest = async (id: string) => {
  const thisRequest = ++loadRequestId
  loading.value = true
  try {
    const resp = await standesdbService.getChangeRequest(id)
    if (thisRequest !== loadRequestId) return
    applyRequest(resp.data)
  } catch {
    if (thisRequest !== loadRequestId) return
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: 'Änderungsantrag konnte nicht geladen werden.',
      life: 5000,
    })
    router.push({ name: 'standesdb-change-requests' })
  } finally {
    if (thisRequest === loadRequestId) loading.value = false
  }
}

watch(
  () => route.params['id'],
  (id) => loadRequest(String(id)),
  { immediate: true },
)

// After a 409 the request may have been decided by another admin or
// overwritten by the member; show the current state in that case. A 409 for
// another reason (e.g. a name collision at resolution) leaves the page as it
// is, so the reviewer keeps the decisions made so far.
const refreshAfterConflict = async (id: string, sentUpdatedAt: string) => {
  try {
    const resp = await standesdbService.getChangeRequest(id)
    if (resp.data.status === 'resolved' || resp.data.updated_at !== sentUpdatedAt) {
      applyRequest(resp.data)
    }
  } catch {
    // The conflict toast already told the reviewer what happened.
  }
}

const submitDecision = async () => {
  const current = request.value
  const payload = decisionPayload.value
  if (!current || !payload || !current.updated_at) return
  submitting.value = true
  try {
    await standesdbService.decideChangeRequest(current.id, payload, current.updated_at)
    toast.add({
      severity: 'success',
      summary: 'Entschieden',
      detail: 'Der Änderungsantrag wurde bearbeitet.',
      life: 4000,
    })
    router.push({ name: 'standesdb-change-requests' })
  } catch (err: unknown) {
    toast.add({
      severity: getApiErrorStatus(err) === HTTP_CONFLICT ? 'warn' : 'error',
      summary: 'Entscheidung nicht gespeichert',
      detail: formatApiError(err, 'Entscheidung konnte nicht gespeichert werden.'),
      life: 8000,
    })
    if (getApiErrorStatus(err) === HTTP_CONFLICT) {
      await refreshAfterConflict(current.id, current.updated_at)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="change-request-review">
    <template v-if="!loading && request">
      <div class="page-header">
        <h2 class="page-title">Änderungsantrag</h2>
        <h3 class="page-subtitle">{{ request.member_cn }}</h3>
        <p class="page-meta">
          Eingereicht am {{ request.created_at ? formatDateTime(request.created_at) : '-' }}
        </p>
        <p v-if="wasResubmitted" class="page-meta">
          Zuletzt geändert am {{ request.updated_at ? formatDateTime(request.updated_at) : '-' }}
        </p>
      </div>

      <Message v-if="isResolved" severity="info" :closable="false" class="resolved-banner">
        Dieser Antrag wurde bereits am
        {{ request.resolved_at ? formatDateTime(request.resolved_at) : '-' }}
        von {{ request.resolved_by_name ?? 'einem Admin' }} entschieden.
      </Message>

      <div v-if="!isResolved" class="bulk-actions">
        <Button
          label="Alle genehmigen"
          icon="pi pi-check"
          severity="secondary"
          size="small"
          @click="setAllDecisions('approved')"
        />
        <Button
          label="Alle ablehnen"
          icon="pi pi-times"
          severity="secondary"
          size="small"
          @click="setAllDecisions('rejected')"
        />
      </div>

      <DataTable :value="request.diff" striped-rows scrollable size="small" data-key="field">
        <Column field="field" header="Feld" style="min-width: 8rem" />
        <Column field="old" header="Alt" style="min-width: 10rem">
          <template #body="{ data }">
            <span class="diff-value">{{ data.old ?? '-' }}</span>
          </template>
        </Column>
        <Column field="new" header="Neu" style="min-width: 10rem">
          <template #body="{ data }">
            <span class="diff-value">{{ data.new ?? '-' }}</span>
          </template>
        </Column>
        <Column header="Entscheidung" style="min-width: 14rem">
          <template #body="{ data }">
            <SelectButton
              v-if="!isResolved"
              :model-value="decisions[data.field]"
              :options="decisionOptions"
              option-label="label"
              option-value="value"
              :aria-label="`Entscheidung für ${data.field}`"
              @update:model-value="decisions[data.field] = $event"
            />
            <Tag
              v-else
              :value="decisionTag(data.field).value"
              :severity="decisionTag(data.field).severity"
            />
          </template>
        </Column>
      </DataTable>

      <div v-if="!isResolved" class="footer-actions">
        <Button
          label="Entscheidung übernehmen"
          icon="pi pi-check"
          severity="danger"
          size="small"
          :disabled="!allDecided"
          :loading="submitting"
          @click="submitDecision"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.change-request-review {
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.page-header {
  text-align: center;
  margin-bottom: 1.75rem;
}

.page-title {
  margin: 0 0 0.5rem;
  font-size: 1.4rem;
  font-weight: 700;
}

.page-subtitle {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.page-meta {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--p-text-muted-color);
}

.resolved-banner {
  margin-bottom: 1rem;
}

.bulk-actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.diff-value {
  font-size: 0.85rem;
  word-break: break-all;
  max-width: 15rem;
  display: inline-block;
}

.footer-actions {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
  padding-bottom: 2rem;
}
</style>
