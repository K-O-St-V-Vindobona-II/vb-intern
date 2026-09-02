<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import p4xService from '@/services/p4xService'
import type { FeeBalanceEntry } from '@/types/p4x'
import { balanceSeverityClass } from './components/balanceSeverityClass'
import Amount from './components/Amount.vue'
import FeeMemberCriteriaInfoBox from './components/FeeMemberCriteriaInfoBox.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'

const router = useRouter()
const toast = useToast()

const loading = ref(true)
const balances = ref<FeeBalanceEntry[]>([])

const goToMember = (id: string) => {
  router.push({ name: 'p4x-fee-member', params: { id } })
}

onMounted(async () => {
  try {
    const resp = await p4xService.getFeeBalances()
    balances.value = resp.data
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: 'Saldenliste konnte nicht geladen werden.',
      life: 5000,
    })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="!loading" class="fee-balances-view">
    <h2>Mitgliedsbeiträge</h2>
    <p class="subtitle">
      Saldenliste — {{ balances.length }} beitragspflichtige Mitglieder mit Beitragskonto
    </p>

    <FeeMemberCriteriaInfoBox />

    <DataTable
      v-if="balances.length"
      :value="balances"
      striped-rows
      size="small"
      scrollable
      sort-field="balance"
      :sort-order="1"
    >
      <Column field="cn" header="Name" sortable>
        <template #body="{ data }">
          <a class="member-link" @click.prevent="goToMember(data.id)">{{ data.cn }}</a>
          <Tag v-if="data.p4x_freed" value="Befreit" severity="info" class="freed-tag" />
        </template>
      </Column>
      <Column field="balance" header="Saldo" sortable style="text-align: right">
        <template #body="{ data }">
          <div style="text-align: right">
            <Amount :amount="data.balance" :color-class="balanceSeverityClass(data.balance)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <p v-else class="empty">Keine Beitragskonten vorhanden.</p>
  </div>
</template>

<style scoped>
.fee-balances-view {
  max-width: 700px;
  margin: 0 auto;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0 0 1.5rem;
}
.member-link {
  cursor: pointer;
  text-decoration: none;
  color: inherit;
}
.member-link:hover {
  text-decoration: underline;
}
.freed-tag {
  margin-left: 0.65rem;
  vertical-align: middle;
}
.empty {
  color: var(--p-text-muted-color);
}
</style>
