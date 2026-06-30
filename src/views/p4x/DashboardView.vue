<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useP4xStore } from '@/stores/p4x'
import p4xService from '@/services/p4xService'
import type { DashboardData, P4xAccount } from '@/types/p4x'
import Amount from './components/Amount.vue'
import TransactionTable from './components/TransactionTable.vue'
import Button from 'primevue/button'
import Menu from 'primevue/menu'

const INACTIVE_THRESHOLD_DAYS = 730

const router = useRouter()
const authStore = useAuthStore()
const p4xStore = useP4xStore()

const loading = ref(true)
const data = ref<DashboardData | null>(null)

const isAdmin = computed(() => authStore.user?.permissions?.includes('p4xAdmin') ?? false)

const isInactive = (account: P4xAccount): boolean => {
  if (!account.transactions_latest) return true
  const latest = new Date(account.transactions_latest)
  const diff = (Date.now() - latest.getTime()) / (1000 * 60 * 60 * 24)
  return diff > INACTIVE_THRESHOLD_DAYS
}

const activeAccounts = computed(() => data.value?.accounts.filter((a) => !isInactive(a)) ?? [])
const inactiveAccounts = computed(() => data.value?.accounts.filter((a) => isInactive(a)) ?? [])

const loadDashboard = async () => {
  loading.value = true
  try {
    const resp = await p4xService.getDashboard()
    data.value = resp.data
  } finally {
    loading.value = false
  }
}

const reloadWarnings = async () => {
  try {
    const resp = await p4xService.getDashboard()
    if (data.value) {
      data.value.warnings_partner = resp.data.warnings_partner
      data.value.warnings_category = resp.data.warnings_category
    }
  } catch {
    /* empty */
  }
}

onMounted(loadDashboard)

const menuRef = ref<Record<number, InstanceType<typeof Menu>>>({})

const getMenuItems = (account: P4xAccount) => {
  const now = new Date()
  const items = [
    {
      label: 'Transaktionen nach...',
      items: [
        {
          label: 'Monat',
          icon: 'pi pi-calendar',
          command: () =>
            router.push({
              name: 'p4x-transactions-month',
              params: { accountId: account.id, year: now.getFullYear(), month: now.getMonth() + 1 },
            }),
        },
        {
          label: 'Partner',
          icon: 'pi pi-user',
          command: () =>
            router.push({
              name: 'p4x-transactions-partner',
              params: { accountId: account.id },
            }),
        },
        {
          label: 'Kategorie',
          icon: 'pi pi-tag',
          command: () =>
            router.push({
              name: 'p4x-transactions-category',
              params: { accountId: account.id },
            }),
        },
      ],
    },
  ]

  if (isAdmin.value) {
    items[0]!.items!.push({
      label: 'Filter',
      icon: 'pi pi-filter',
      command: () =>
        router.push({
          name: 'p4x-transactions-filter',
          params: { accountId: account.id },
        }),
    })

    items.push({
      label: 'Administration',
      items: [
        {
          label: 'Bearbeiten',
          icon: 'pi pi-cog',
          command: () =>
            router.push({
              name: 'p4x-account-edit',
              params: { id: account.id },
            }),
        },
        {
          label: 'Transaktionen importieren',
          icon: 'pi pi-upload',
          command: () =>
            router.push({
              name: 'p4x-account-import',
              params: { accountId: account.id },
            }),
        },
      ],
    })
  }

  return items
}

const toggleMenu = (event: Event, accountId: number) => {
  menuRef.value[accountId]?.toggle(event)
}
</script>

<template>
  <div v-if="!loading && data" class="p4x-dashboard">
    <h2>AH-Kassen</h2>
    <p class="subtitle">Konten-Übersicht</p>

    <div class="accounts-list">
      <div v-for="account in activeAccounts" :key="account.id" class="account-card">
        <div class="account-row">
          <div class="account-info">
            <i v-tooltip="'Details'" class="pi pi-info-circle clickable" />
            <span class="account-label">{{ account.label }}</span>
          </div>
          <div class="account-right">
            <Amount :amount="account.balance" />
            <Button
              icon="pi pi-chevron-down"
              text
              size="small"
              @click="toggleMenu($event, account.id)"
            />
            <Menu
              :ref="
                (el) => {
                  if (el) menuRef[account.id] = el as unknown as InstanceType<typeof Menu>
                }
              "
              :model="getMenuItems(account)"
              :popup="true"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="inactiveAccounts.length" class="inactive-toggle">
      <span class="toggle-link" @click="p4xStore.toggleInactive()">
        {{ p4xStore.showInactive ? 'verberge' : 'zeige' }} inaktive Konten
      </span>
      <div v-if="p4xStore.showInactive" class="inactive-section">
        <small class="inactive-hint">
          Konten gelten als inaktiv, wenn länger als {{ INACTIVE_THRESHOLD_DAYS }} Tage keine
          Transaktion stattfand.
        </small>
        <div v-for="account in inactiveAccounts" :key="account.id" class="account-card">
          <div class="account-row">
            <div class="account-info">
              <i class="pi pi-info-circle" />
              <span class="account-label">{{ account.label }}</span>
            </div>
            <div class="account-right">
              <Amount :amount="account.balance" />
              <Button
                icon="pi pi-chevron-down"
                text
                size="small"
                @click="toggleMenu($event, account.id)"
              />
              <Menu
                :ref="
                  (el) => {
                    if (el) menuRef[account.id] = el as unknown as InstanceType<typeof Menu>
                  }
                "
                :model="getMenuItems(account)"
                :popup="true"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isAdmin" class="create-link">
      <router-link :to="{ name: 'p4x-account-new' }"> Konto anlegen </router-link>
    </div>

    <div
      v-if="data.warnings_partner.count || data.warnings_category.count"
      class="warnings-section"
    >
      <h3>
        Warnungen
        <Button
          v-tooltip="'Warnungen neu laden'"
          icon="pi pi-refresh"
          text
          size="small"
          @click="reloadWarnings"
        />
      </h3>

      <TransactionTable
        v-if="data.warnings_partner.count"
        :transactions="data.warnings_partner.preview"
        :categories="data.categories"
        :title="`Transaktionen ohne Partner (${data.warnings_partner.count})`"
        :admin="isAdmin"
        @refresh="reloadWarnings"
      />

      <TransactionTable
        v-if="data.warnings_category.count"
        :transactions="data.warnings_category.preview"
        :categories="data.categories"
        :title="`Transaktionen ohne eindeutige Kategorisierung (${data.warnings_category.count})`"
        :admin="isAdmin"
        @refresh="reloadWarnings"
      />
    </div>
  </div>
</template>

<style scoped>
.p4x-dashboard {
  max-width: 900px;
  margin: 0 auto;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0 0 1.5rem;
}
.account-card {
  background: var(--p-surface-50);
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
}
.account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.account-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.account-label {
  font-size: 1.1rem;
  font-weight: 500;
}
.account-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
}
.inactive-toggle {
  text-align: center;
  margin: 0.5rem 0;
}
.toggle-link {
  color: var(--p-text-muted-color);
  cursor: pointer;
  font-size: 0.85rem;
}
.toggle-link:hover {
  text-decoration: underline;
}
.inactive-section {
  margin-top: 0.5rem;
}
.inactive-hint {
  color: var(--p-text-muted-color);
  display: block;
  margin-bottom: 0.5rem;
}
.create-link {
  text-align: center;
  margin: 0.5rem 0 2rem;
}
.create-link a {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}
.warnings-section {
  margin-top: 2rem;
}
.clickable {
  cursor: pointer;
}
</style>
