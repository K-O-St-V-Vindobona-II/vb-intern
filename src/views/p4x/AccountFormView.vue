<script setup lang="ts">
import { formatApiError } from '@/utils/formatters'
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import p4xService from '@/services/p4xService'
import type { P4xAccount } from '@/types/p4x'
import FormAmount from './components/FormAmount.vue'
import InputText from 'primevue/inputtext'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const isEdit = computed(() => !!route.params['id'])
const loading = ref(true)
const saving = ref(false)

const form = ref({
  iban: '',
  bic: '',
  label: '',
  init_date: null as Date | null,
  init_balance: 0,
})

onMounted(async () => {
  if (isEdit.value) {
    try {
      const resp = await p4xService.getDashboard()
      const account = resp.data.accounts.find(
        (a: P4xAccount) => a.id === Number(route.params['id']),
      )
      if (account) {
        form.value = {
          iban: account.iban,
          bic: account.bic ?? '',
          label: account.label ?? '',
          init_date: account.init_date ? new Date(account.init_date) : null,
          init_balance: account.init_balance,
        }
      }
    } catch {
      /* empty */
    }
  }
  loading.value = false
})

const save = async () => {
  saving.value = true
  try {
    const data = {
      iban: form.value.iban,
      bic: form.value.bic,
      label: form.value.label,
      init_date: form.value.init_date ? form.value.init_date.toISOString().slice(0, 10) : '',
      init_balance: form.value.init_balance,
    }

    if (isEdit.value) {
      await p4xService.updateAccount(Number(route.params['id']), data)
      toast.add({ severity: 'success', summary: 'Gespeichert', life: 2000 })
    } else {
      await p4xService.createAccount(data)
      toast.add({ severity: 'success', summary: 'Konto angelegt', life: 2000 })
    }
    router.push({ name: 'p4x-dashboard' })
  } catch (e: unknown) {
    const msg = formatApiError(e)
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="!loading" class="account-form">
    <h2>Konto</h2>
    <p class="subtitle">
      {{ isEdit ? 'Konto bearbeiten' : 'Konto anlegen' }}
    </p>

    <div class="form-grid">
      <div class="field">
        <label>IBAN</label>
        <InputText v-model="form.iban" :maxlength="34" />
      </div>
      <div class="field">
        <label>BIC</label>
        <InputText v-model="form.bic" :maxlength="11" />
      </div>
      <div class="field">
        <label>Bezeichnung</label>
        <InputText v-model="form.label" :maxlength="32" />
      </div>
      <div class="field">
        <label>Initialdatum</label>
        <DatePicker v-model="form.init_date" :manual-input="false" date-format="dd.mm.yy" />
      </div>
      <div class="field">
        <label>Initialstand</label>
        <FormAmount v-model="form.init_balance" />
      </div>
    </div>

    <div class="actions">
      <Button label="Speichern" :loading="saving" @click="save" />
      <Button
        label="Zur Liste"
        severity="secondary"
        @click="router.push({ name: 'p4x-dashboard' })"
      />
    </div>
  </div>
</template>

<style scoped>
.account-form {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0 0 1.5rem;
}
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: left;
  max-width: 400px;
  margin: 0 auto;
}
.field label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.3rem;
}
.field :deep(input),
.field :deep(.p-datepicker),
.field :deep(.p-inputnumber) {
  width: 100%;
}
.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.5rem;
  justify-content: center;
}
</style>
