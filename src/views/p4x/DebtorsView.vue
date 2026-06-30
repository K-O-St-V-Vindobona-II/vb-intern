<script setup lang="ts">
import { ref, onMounted } from 'vue'
import p4xService from '@/services/p4xService'
import type { Debtor } from '@/types/p4x'
import Amount from './components/Amount.vue'

const loading = ref(true)
const debtors = ref<Debtor[]>([])

onMounted(async () => {
  try {
    const resp = await p4xService.getDebtors()
    debtors.value = resp.data
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="!loading" class="debtors-view">
    <h2>Mitgliedsbeiträge</h2>
    <p class="subtitle">Schuldnerliste</p>

    <div class="debtors-list">
      <div v-for="debtor in debtors" :key="debtor.id" class="debtor-row">
        <router-link
          :to="{ name: 'p4x-fee-member', params: { id: debtor.id } }"
          class="debtor-name"
        >
          {{ debtor.cn }}
        </router-link>
        <Amount :amount="debtor.balance" />
      </div>
    </div>

    <p v-if="!debtors.length" class="empty">Keine offenen Beträge vorhanden.</p>
  </div>
</template>

<style scoped>
.debtors-view {
  max-width: 700px;
  margin: 0 auto;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0 0 1.5rem;
}
.debtor-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--p-surface-200);
}
.debtor-name {
  text-decoration: none;
  color: inherit;
}
.debtor-name:hover {
  text-decoration: underline;
}
.empty {
  color: var(--p-text-muted-color);
}
</style>
