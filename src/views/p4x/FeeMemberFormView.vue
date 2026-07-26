<script setup lang="ts">
import { formatApiError } from '@/utils/formatters'
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import p4xService from '@/services/p4xService'
import FormAmount from './components/FormAmount.vue'
import InputText from 'primevue/inputtext'
import DatePicker from 'primevue/datepicker'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const memberId = Number(route.params['id'])

const loading = ref(true)
const saving = ref(false)
const memberName = ref('')

const form = ref({
  init_date: null as Date | null,
  init_balance: 0,
  freed: false,
  comment: '',
})

onMounted(async () => {
  try {
    const resp = await p4xService.getFeeMember(memberId)
    memberName.value = resp.data.cn
    form.value = {
      init_date: resp.data.p4x_init_date ? new Date(resp.data.p4x_init_date) : null,
      init_balance: resp.data.p4x_init_balance ?? 0,
      freed: resp.data.p4x_freed ?? false,
      comment: resp.data.p4x_comment ?? '',
    }
  } finally {
    loading.value = false
  }
})

const goToMember = () => router.push({ name: 'p4x-fee-member', params: { id: memberId } })

const save = async () => {
  saving.value = true
  try {
    const data = {
      p4x_init_date: form.value.init_date ? form.value.init_date.toISOString().slice(0, 10) : '',
      p4x_init_balance: form.value.init_balance,
      p4x_freed: form.value.freed,
      p4x_comment: form.value.comment.trim() || null,
    }
    await p4xService.updateFeeMember(memberId, data)
    toast.add({ severity: 'success', summary: 'Gespeichert', life: 2000 })
    await goToMember()
  } catch (e: unknown) {
    const msg = formatApiError(e)
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="!loading" class="fee-member-form">
    <h2>Mitgliedsbeiträge</h2>
    <p class="subtitle">{{ memberName }} bearbeiten</p>

    <div class="form-grid">
      <div class="field">
        <label>Initialdatum</label>
        <DatePicker v-model="form.init_date" :manual-input="false" date-format="dd.mm.yy" />
      </div>
      <div class="field">
        <label>Initialstand</label>
        <FormAmount v-model="form.init_balance" />
      </div>
      <div class="field field-checkbox">
        <Checkbox v-model="form.freed" :binary="true" input-id="freed" />
        <label for="freed">Vom Mitgliedsbeitrag befreit</label>
      </div>
      <div class="field">
        <label>Kommentar</label>
        <InputText v-model="form.comment" :maxlength="250" />
      </div>
    </div>

    <div class="actions">
      <Button label="Speichern" :loading="saving" @click="save" />
      <Button label="Abbrechen" severity="secondary" @click="goToMember" />
    </div>
  </div>
</template>

<style scoped>
.fee-member-form {
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
.field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.field-checkbox label {
  margin-bottom: 0;
}
.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.5rem;
  justify-content: center;
}
</style>
