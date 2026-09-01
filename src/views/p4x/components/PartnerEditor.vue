<script setup lang="ts">
import { ref, watch } from 'vue'
import type { P4xTransaction, PartnerRef, PartnerSearchResult } from '@/types/p4x'
import p4xService from '@/services/p4xService'
import PartnerSearch from './PartnerSearch.vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'

const props = defineProps<{ transaction: P4xTransaction }>()
const emit = defineEmits<{ changed: [tx: P4xTransaction] }>()

const visible = ref(false)
const partner = ref<PartnerSearchResult | null>(null)
const hasDelegating = ref(false)
const delegatingPartner = ref<PartnerSearchResult | null>(null)

const toSearchResult = (ref: PartnerRef): PartnerSearchResult => ({
  type: ref.type,
  id: ref.id,
  label: ref.cn,
})

const toPartnerRef = (r: PartnerSearchResult): PartnerRef => ({
  type: r.type,
  id: r.id,
  cn: r.label,
})

const open = () => {
  partner.value = props.transaction.partner ? toSearchResult(props.transaction.partner) : null
  hasDelegating.value = !!props.transaction.delegating_partner
  delegatingPartner.value = props.transaction.delegating_partner
    ? toSearchResult(props.transaction.delegating_partner)
    : null
  visible.value = true
}

watch(partner, (val) => {
  if (!val) {
    hasDelegating.value = false
    delegatingPartner.value = null
  }
})

const save = async () => {
  if (!partner.value) {
    hasDelegating.value = false
    delegatingPartner.value = null
  }
  if (!hasDelegating.value) {
    delegatingPartner.value = null
  }

  try {
    const resp = await p4xService.setTransactionPartner(props.transaction.id, {
      partner: partner.value ? toPartnerRef(partner.value) : null,
      hasDelegatingPartner: hasDelegating.value,
      delegatingPartner: delegatingPartner.value ? toPartnerRef(delegatingPartner.value) : null,
    })
    emit('changed', resp.data as P4xTransaction)
    visible.value = false
  } catch {
    /* empty */
  }
}

defineExpose({ open })
</script>

<template>
  <Dialog v-model:visible="visible" header="Partner bearbeiten" :modal="true" style="width: 40rem">
    <div class="section">
      <div class="section-title">Unmittelbarer Partner</div>
      <p class="hint">
        Hier wird die IBAN vom Sender bzw. Empfänger der Transaktion mit einer Person/Organisation
        verbunden. Eine Änderung wirkt für alle Transaktionen mit derselben IBAN.
      </p>
      <PartnerSearch v-model="partner" />
    </div>

    <div v-if="partner" class="section">
      <hr />
      <Checkbox v-model="hasDelegating" :binary="true" input-id="delegating-check" />
      <label for="delegating-check" class="section-title" style="margin-left: 0.5rem">
        Delegierender Partner
      </label>
      <p class="hint">
        Beispiel: Mitglied B übergibt Mitglied A einen Geldbetrag, mit der Bitte, diesen auf das
        Konto als Spende einzuzahlen. Dann ist Mitglied A der unmittelbare Partner, Mitglied B der
        delegierende Partner.
      </p>
      <PartnerSearch v-if="hasDelegating" v-model="delegatingPartner" />
    </div>

    <template #footer>
      <Button label="Schließen" severity="secondary" @click="visible = false" />
      <Button label="Speichern" @click="save" />
    </template>
  </Dialog>
</template>

<style scoped>
.section {
  margin-bottom: 1rem;
}
.section-title {
  font-weight: 600;
  margin-bottom: 0.25rem;
}
.hint {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin: 0.25rem 0 0.75rem;
}
</style>
