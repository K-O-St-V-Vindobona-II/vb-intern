<script setup lang="ts">
import { ref, onMounted } from 'vue'
import p4xService from '@/services/p4xService'
import type { SumUpBalance } from '@/types/p4x'
import Amount from './components/Amount.vue'

const loading = ref(true)
const data = ref<SumUpBalance | null>(null)

const formatDate = (d: string | null): string => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' })
}

onMounted(async () => {
  try {
    const resp = await p4xService.getSumupBalance()
    data.value = resp.data
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="!loading" class="sumup-view">
    <h2>Sum Up</h2>
    <p class="subtitle">Saldo</p>

    <div v-if="data" class="sumup-card">
      <div class="section">
        <strong>Letzte Transaktion</strong>
        <div>{{ formatDate(data.latest) }}</div>
      </div>

      <div class="section">
        <strong>Eingänge</strong>
        <div>Anzahl: {{ data.in_count }}</div>
        <div>Summe: <Amount :amount="data.in_sum" /></div>
      </div>

      <div class="section">
        <strong>Ausgänge</strong>
        <div>Anzahl: {{ data.out_count }}</div>
        <div>Summe: <Amount :amount="data.out_sum" /></div>
      </div>

      <div class="section saldo">
        <strong>Saldo</strong>
        <div class="saldo-hint">
          Betrag, der regelmässig an die Bar-Kassa überwiesen werden soll
        </div>
        <div class="saldo-amount">
          <Amount :amount="data.in_sum + data.out_sum" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sumup-view {
  max-width: 600px;
  margin: 0 auto;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0 0 1.5rem;
}
.sumup-card {
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 10px;
  padding: 1.5rem;
}
.section {
  margin-bottom: 1.25rem;
}
.section strong {
  display: block;
  margin-bottom: 0.25rem;
}
.saldo {
  border-top: 1px solid var(--p-surface-200);
  padding-top: 1rem;
}
.saldo-hint {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.5rem;
}
.saldo-amount {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--p-surface-300);
  border-radius: 6px;
  font-size: 1.1rem;
}
</style>
