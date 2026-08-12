<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import p4xService from '@/services/p4xService'
import type { FeeMemberSelf } from '@/types/p4x'
import { formatFullDate, getApiErrorStatus } from '@/utils/formatters'
import { downloadBlobResponse } from '@/utils/downloadBlob'
import Amount from './components/Amount.vue'
import Button from 'primevue/button'
import Message from 'primevue/message'

const toast = useToast()

const loading = ref(true)
const exporting = ref(false)
const account = ref<FeeMemberSelf | null>(null)
const notEligible = ref(false)
const showProgress = ref(false)

const isFreed = computed(() => !!account.value?.p4x_freed)
const hasFeeSetup = computed(
  () => !!account.value?.p4x_init_date && account.value?.p4x_init_balance !== null,
)
const showOverview = computed(() => hasFeeSetup.value && !isFreed.value)

const doExport = async () => {
  exporting.value = true
  try {
    const resp = await p4xService.exportOwnFeeMember()
    const filename = downloadBlobResponse(resp, 'Mein_Beitragskonto.xlsx')
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
  try {
    const resp = await p4xService.getOwnFeeMember()
    account.value = resp.data
  } catch (e) {
    if (getApiErrorStatus(e) === 404) {
      notEligible.value = true
    } else {
      toast.add({
        severity: 'error',
        summary: 'Fehler',
        detail: 'Beitragskonto konnte nicht geladen werden.',
        life: 5000,
      })
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="my-fee-account-view">
    <h2>Mein Beitragskonto</h2>
    <p class="subtitle">Saldo und Buchungsverlauf deines Mitgliedsbeitrags</p>

    <Message v-if="notEligible" severity="info" :closable="false">
      Für dein Konto ist derzeit kein Beitragskonto hinterlegt.
    </Message>

    <div v-else-if="account && !loading" class="account-detail">
      <p v-if="isFreed" class="account-freed">Vom Mitgliedsbeitrag befreit</p>

      <template v-if="!isFreed">
        <template v-if="hasFeeSetup">
          <div class="balance-grid">
            <div class="balance-row">
              <span class="balance-label">Initialdatum:</span>
              <span>{{ formatFullDate(account.p4x_init_date) }}</span>
            </div>
            <div class="balance-row">
              <span class="balance-label">Initialstand:</span>
              <Amount :amount="account.p4x_init_balance ?? 0" />
            </div>
            <template v-if="account.balance">
              <div class="balance-row">
                <span class="balance-label"
                  >{{ account.balance.count.fees }} verrechnete Beiträge:</span
                >
                <Amount :amount="account.balance.sum.fees" />
              </div>
              <div class="balance-row">
                <span class="balance-label"
                  >{{ account.balance.count.payments }} geleistete Zahlungen:</span
                >
                <Amount :amount="account.balance.sum.payments" />
              </div>
              <div class="balance-row">
                <span class="balance-label">Enddatum:</span>
                <span>{{ formatFullDate(account.balance.end_date) }}</span>
              </div>
              <div class="balance-row balance-total">
                <span class="balance-label">Endstand:</span>
                <Amount :amount="account.balance.end_balance" />
              </div>
            </template>
          </div>
        </template>

        <p v-else class="no-setup-hint">Für dein Konto sind noch keine Beitragsdaten hinterlegt.</p>
      </template>

      <div v-if="showOverview" class="account-actions">
        <Button
          label="Export Excel"
          icon="pi pi-file-excel"
          severity="secondary"
          :loading="exporting"
          @click="doExport"
        />
      </div>

      <div v-if="showOverview && account.balance?.progress?.length" class="progress-section">
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
              <tr v-for="(entry, i) in account.balance.progress" :key="i" class="progress-entry">
                <td>{{ formatFullDate(entry.booking) }}</td>
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
.my-fee-account-view {
  max-width: 700px;
  margin: 0 auto;
  text-align: center;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0 0 1.5rem;
}
.account-detail {
  margin-top: 1rem;
}
.account-freed {
  max-width: 500px;
  margin: 0 auto 0.5rem;
  color: var(--p-red-600, #dc2626);
  font-weight: 700;
  font-size: 0.85rem;
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
  border-top: 1px solid var(--app-border-card);
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
  border-bottom: 1px solid var(--app-border-card);
  padding-bottom: 0.3rem;
}
.no-setup-hint {
  max-width: 500px;
  margin: 1rem auto 0;
  color: var(--p-text-muted-color);
}
.account-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 1.5rem;
}
</style>
