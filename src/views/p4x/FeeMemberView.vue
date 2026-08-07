<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import p4xService from '@/services/p4xService'
import type { FeeMember } from '@/types/p4x'
import Amount from './components/Amount.vue'
import FeeMemberCriteriaInfoBox from './components/FeeMemberCriteriaInfoBox.vue'
import Button from 'primevue/button'
import SearchField from '@/components/SearchField.vue'
import type { SearchResult } from '@/components/SearchField.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const exporting = ref(false)
const member = ref<FeeMember | null>(null)
const showProgress = ref(false)

const isFreed = computed(() => !!member.value?.p4x_freed)
const hasFeeSetup = computed(
  () => !!member.value?.p4x_init_date && member.value?.p4x_init_balance !== null,
)
const showOverview = computed(() => hasFeeSetup.value && !isFreed.value)

const searchFeeMembers = async (query: string): Promise<SearchResult[]> => {
  const resp = await p4xService.searchFeeMembers(query)
  return resp.data.data
}

const onMemberSelect = async (item: SearchResult) => {
  loading.value = true
  try {
    const resp = await p4xService.getFeeMember(item.id)
    member.value = resp.data
  } finally {
    loading.value = false
  }
}

const formatDate = (d: string | null): string => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' })
}

const goToEdit = () => {
  if (!member.value) return
  router.push({ name: 'p4x-fee-member-edit', params: { id: member.value.id } })
}

const doExport = async () => {
  if (!member.value) return
  exporting.value = true
  try {
    const resp = await p4xService.exportFeeMember(member.value.id)

    const disposition = resp.headers['content-disposition'] ?? ''
    const match = disposition.match(/filename="?([^"]+)"?/)
    const filename = match ? match[1] : `Beitragskonto_${member.value.id}.xlsx`

    const url = URL.createObjectURL(resp.data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    toast.add({
      severity: 'success',
      summary: 'Export erstellt',
      detail: `${filename} wurde heruntergeladen.`,
      life: 3000,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: 'Export fehlgeschlagen.',
      life: 5000,
    })
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  const id = route.params['id'] ? Number(route.params['id']) : null
  if (id) {
    loading.value = true
    try {
      const resp = await p4xService.getFeeMember(id)
      member.value = resp.data
    } finally {
      loading.value = false
    }
  }
})
</script>

<template>
  <div class="fee-member-view">
    <h2>Mitgliedsbeiträge</h2>
    <p class="subtitle">Beitragskonten</p>

    <div class="search-box">
      <SearchField
        :search-fn="searchFeeMembers"
        placeholder="Mitglied suchen..."
        @select="onMemberSelect"
      />
    </div>

    <FeeMemberCriteriaInfoBox />

    <div v-if="member && !loading" class="member-detail">
      <div class="member-name">
        {{ member.cn }}
      </div>

      <p v-if="isFreed" class="member-freed">Vom Mitgliedsbeitrag befreit</p>

      <p v-if="member.p4x_comment" class="member-comment">{{ member.p4x_comment }}</p>

      <template v-if="!isFreed">
        <template v-if="hasFeeSetup">
          <div class="balance-grid">
            <div class="balance-row">
              <span class="balance-label">Initialdatum:</span>
              <span>{{ formatDate(member.p4x_init_date) }}</span>
            </div>
            <div class="balance-row">
              <span class="balance-label">Initialstand:</span>
              <Amount :amount="member.p4x_init_balance ?? 0" />
            </div>
            <template v-if="member.balance">
              <div class="balance-row">
                <span class="balance-label"
                  >{{ member.balance.count.fees }} verrechnete Beiträge:</span
                >
                <Amount :amount="member.balance.sum.fees" />
              </div>
              <div class="balance-row">
                <span class="balance-label"
                  >{{ member.balance.count.payments }} geleistete Zahlungen:</span
                >
                <Amount :amount="member.balance.sum.payments" />
              </div>
              <div class="balance-row">
                <span class="balance-label">Enddatum:</span>
                <span>{{ formatDate(member.balance.end_date) }}</span>
              </div>
              <div class="balance-row balance-total">
                <span class="balance-label">Endstand:</span>
                <Amount :amount="member.balance.end_balance" />
              </div>
            </template>
          </div>
        </template>

        <p v-else class="no-setup-hint">
          Für dieses Mitglied sind noch keine Beitragsdaten hinterlegt. Bitte Initialdatum und
          Initialstand über "Bearbeiten" festlegen.
        </p>
      </template>

      <div class="member-actions">
        <Button label="Bearbeiten" icon="pi pi-pencil" severity="secondary" @click="goToEdit" />
        <Button
          v-if="showOverview"
          label="Export Excel"
          icon="pi pi-file-excel"
          severity="secondary"
          :loading="exporting"
          @click="doExport"
        />
      </div>

      <div v-if="showOverview && member.balance?.progress?.length" class="progress-section">
        <div class="progress-toggle" @click="showProgress = !showProgress">
          <i :class="showProgress ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
          Verlauf
        </div>
        <div v-if="showProgress" class="progress-list">
          <table class="progress-table">
            <thead>
              <tr class="progress-header">
                <th>Datum</th>
                <th>Transaktionsart</th>
                <th class="align-right">Betrag</th>
                <th class="align-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry, i) in member.balance.progress" :key="i" class="progress-entry">
                <td>{{ formatDate(entry.booking) }}</td>
                <td>{{ entry.type === 'fee' ? 'Fälligkeit' : 'Zahlung' }}</td>
                <td class="align-right"><Amount :amount="entry.amount" /></td>
                <td class="align-right"><Amount :amount="entry.balance" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fee-member-view {
  max-width: 700px;
  margin: 0 auto;
  text-align: center;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0 0 1rem;
}
.search-box {
  margin: 0 auto 1.5rem;
  max-width: 400px;
}
.member-detail {
  margin-top: 1rem;
}
.member-name {
  font-size: 1.1rem;
  font-weight: 500;
  margin-bottom: 1rem;
}
.member-freed {
  max-width: 500px;
  margin: 0 auto 0.5rem;
  color: var(--p-red-600, #dc2626);
  font-weight: 700;
  font-size: 0.85rem;
}
.member-comment {
  max-width: 500px;
  margin: 0 auto 1rem;
  color: var(--p-text-muted-color);
  font-style: italic;
}
.balance-grid {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-width: 500px;
  margin: 0 auto;
  text-align: left;
}
.balance-row {
  display: flex;
  justify-content: space-between;
}
.balance-label {
  font-weight: 600;
}
.balance-total {
  border-top: 1px solid var(--p-surface-300);
  padding-top: 0.3rem;
  margin-top: 0.3rem;
}
.progress-section {
  margin-top: 1.5rem;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
  text-align: left;
}
.progress-toggle {
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}
.progress-list {
  max-height: 400px;
  overflow-y: auto;
  overflow-x: auto;
}
.progress-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.progress-table th,
.progress-table td {
  padding: 0.2rem 0.4rem;
  text-align: left;
  white-space: nowrap;
}
.progress-table th:first-child,
.progress-table td:first-child {
  padding-left: 0;
}
.progress-table th.align-right,
.progress-table td.align-right {
  text-align: right;
}
.progress-header th {
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  border-bottom: 1px solid var(--p-surface-300);
  padding-bottom: 0.3rem;
}
.no-setup-hint {
  max-width: 500px;
  margin: 1rem auto 0;
  color: var(--p-text-muted-color);
}
.member-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 1.5rem;
}
</style>
