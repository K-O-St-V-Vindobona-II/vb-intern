<script setup lang="ts">
import type { PartnerRef } from '@/types/p4x'

defineProps<{
  partner: PartnerRef
  delegatingPartner?: PartnerRef | null
}>()

const typeLabels: Record<string, string> = {
  member: 'Mitglied',
  contact: 'Kontakt',
  account: 'Konto',
  special: 'Spezial',
}

const typeIcons: Record<string, string> = {
  member: 'pi-user',
  contact: 'pi-building',
  account: 'pi-wallet',
  special: 'pi-star',
}
</script>

<template>
  <div class="partner-label">
    <div>
      <i :class="['pi', typeIcons[partner.type] || 'pi-question']" style="margin-right: 0.3rem" />
      <strong>{{ typeLabels[partner.type] || partner.type }}:</strong>
      {{ partner.cn }}
    </div>
    <div v-if="delegatingPartner" class="delegating">
      <i class="pi pi-arrow-right" style="margin-right: 0.3rem; font-size: 0.75rem" />
      <small>
        <strong>{{ typeLabels[delegatingPartner.type] }}:</strong>
        {{ delegatingPartner.cn }}
      </small>
    </div>
  </div>
</template>

<style scoped>
.delegating {
  color: var(--p-text-muted-color);
  margin-top: 0.15rem;
}
</style>
