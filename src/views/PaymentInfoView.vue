<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import api from '@/services/api'

interface PaymentInfo {
  title: string
  name: string
  iban: string
  bic: string
  fee: string
}

const toast = useToast()
const loading = ref(true)
const entries = ref<PaymentInfo[]>([])

const copyToClipboard = async (text: string) => {
  await navigator.clipboard.writeText(text)
  toast.add({
    severity: 'success',
    summary: 'Kopiert',
    detail: text,
    life: 2000,
  })
}

onMounted(async () => {
  try {
    const resp = await api.get<PaymentInfo[]>('/information/payment')
    entries.value = resp.data
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="!loading" class="payment-page">
    <h2>Information</h2>
    <p class="payment-subtitle">Zahlungsinformation</p>

    <div class="cards-grid">
      <div v-for="(info, i) in entries" :key="i" class="payment-card">
        <div class="card-accent" />
        <h3 class="card-title">
          {{ info.title }}
        </h3>
        <p class="card-name">
          {{ info.name }}
        </p>

        <div class="card-details">
          <div class="detail-item">
            <span class="detail-label">IBAN</span>
            <span class="detail-value detail-mono">
              {{ info.iban }}
              <i
                v-tooltip="'Kopieren'"
                class="pi pi-copy copy-btn"
                @click="copyToClipboard(info.iban)"
              />
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">BIC</span>
            <span class="detail-value detail-mono">
              {{ info.bic }}
              <i
                v-tooltip="'Kopieren'"
                class="pi pi-copy copy-btn"
                @click="copyToClipboard(info.bic)"
              />
            </span>
          </div>
        </div>

        <div class="card-fee">
          <i class="pi pi-info-circle fee-icon" />
          {{ info.fee }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.payment-page {
  max-width: 900px;
  margin: 0 auto;
}
.payment-subtitle {
  color: var(--p-text-muted-color);
  margin: 0 0 1.5rem;
}
.cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}
@media (min-width: 640px) {
  .cards-grid {
    grid-template-columns: 1fr 1fr;
  }
}
.payment-card {
  position: relative;
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 12px;
  padding: 2rem 1.5rem 1.25rem;
  text-align: center;
  overflow: hidden;
  transition: box-shadow 0.2s;
}
.payment-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}
.card-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--p-primary-400), var(--p-primary-600));
}
.card-title {
  margin: 0 0 0.25rem;
  font-size: 1.15rem;
}
.card-name {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  margin: 0 0 1.25rem;
  line-height: 1.3;
}
.card-details {
  background: var(--p-surface-50);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}
.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0;
}
.detail-item + .detail-item {
  border-top: 1px solid var(--p-surface-200);
}
.detail-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
}
.detail-value {
  font-weight: 500;
}
.detail-mono {
  font-family: monospace;
  font-size: 0.85rem;
  letter-spacing: 0.03em;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.copy-btn {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s;
}
.copy-btn:hover {
  opacity: 1;
  color: var(--p-primary-600);
}
.card-fee {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--p-primary-700);
  font-weight: 500;
  padding: 0.5rem;
  background: var(--p-primary-50);
  border-radius: 6px;
}
.fee-icon {
  font-size: 0.9rem;
}
</style>
