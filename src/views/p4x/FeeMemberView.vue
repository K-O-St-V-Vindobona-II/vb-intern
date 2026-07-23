<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import p4xService from '@/services/p4xService'
import type { FeeMember } from '@/types/p4x'
import Amount from './components/Amount.vue'
import PersonSearchField from '@/components/PersonSearchField.vue'
import type { SearchResult } from '@/components/PersonSearchField.vue'

const route = useRoute()

const loading = ref(false)
const member = ref<FeeMember | null>(null)
const showProgress = ref(false)

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
      <PersonSearchField
        :search-fn="searchFeeMembers"
        placeholder="Mitglied suchen..."
        @select="onMemberSelect"
      />
    </div>

    <div v-if="member && !loading" class="member-detail">
      <div class="member-name">
        {{ member.cn }}
      </div>

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
            <span class="balance-label">{{ member.balance.count.fees }} verrechnete Beiträge:</span>
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

      <div v-if="member.balance?.progress?.length" class="progress-section">
        <div class="progress-toggle" @click="showProgress = !showProgress">
          <i :class="showProgress ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
          Verlauf
        </div>
        <div v-if="showProgress" class="progress-list">
          <div v-for="(entry, i) in member.balance.progress" :key="i" class="progress-entry">
            <span>
              {{ formatDate(entry.booking) }}:
              {{ entry.type === 'fee' ? 'Fälligkeit' : 'Zahlung' }}
            </span>
            <Amount :amount="entry.amount" />
          </div>
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
}
.progress-entry {
  display: flex;
  justify-content: space-between;
  padding: 0.15rem 0;
  font-size: 0.85rem;
}
</style>
