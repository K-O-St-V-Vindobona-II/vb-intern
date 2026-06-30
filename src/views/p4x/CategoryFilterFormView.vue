<script setup lang="ts">
import { formatApiError } from '@/utils/formatters'
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import p4xService from '@/services/p4xService'
import type { P4xAccount, P4xCategory } from '@/types/p4x'
import FormAmount from './components/FormAmount.vue'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const isEdit = computed(() => !!route.params.id)
const loading = ref(true)
const saving = ref(false)
const accounts = ref<P4xAccount[]>([])
const categories = ref<P4xCategory[]>([])

const useMin = ref(false)
const useMax = ref(false)

const form = ref({
  name: '',
  p4x_account_id: null as number | null,
  iban: '',
  min_amount: 0,
  max_amount: 0,
  subject_mode: 'equals',
  subject: '',
  p4x_category_id: null as number | null,
})

const subjectModeOptions = [
  { label: 'ist gleich', value: 'equals' },
  { label: 'enthält', value: 'contains' },
  { label: 'beginnt mit', value: 'starts' },
]

const accountOptions = computed(() =>
  accounts.value.map((a) => ({
    label: `${a.label} (${a.iban})`,
    value: a.id,
  })),
)

const categoryOptions = computed(() =>
  categories.value.map((c) => ({
    label: `${c.name} (${c.label})`,
    value: c.id,
  })),
)

onMounted(async () => {
  try {
    const [dashResp] = await Promise.all([p4xService.getDashboard()])
    accounts.value = dashResp.data.accounts
    categories.value = dashResp.data.categories

    if (isEdit.value) {
      const fResp = await p4xService.getCategoryFilters()
      const filter = fResp.data.find((f) => f.id === Number(route.params.id))
      if (filter) {
        form.value = {
          name: filter.name,
          p4x_account_id: filter.p4x_account_id,
          iban: filter.iban ?? '',
          min_amount: filter.min_amount ?? 0,
          max_amount: filter.max_amount ?? 0,
          subject_mode: filter.subject_mode,
          subject: filter.subject ?? '',
          p4x_category_id: filter.p4x_category_id,
        }
        useMin.value = filter.min_amount !== null
        useMax.value = filter.max_amount !== null
      }
    } else {
      const q = route.query
      if (q.accountId) {
        form.value.p4x_account_id = Number(q.accountId)
      } else {
        form.value.p4x_account_id = accounts.value[0]?.id ?? null
      }
      form.value.p4x_category_id = categories.value[0]?.id ?? null
      if (q.iban) {
        form.value.iban = String(q.iban)
      }
      if (q.amount) {
        const amount = Number(q.amount)
        form.value.min_amount = amount
        form.value.max_amount = amount
        useMin.value = true
        useMax.value = true
      }
      if (q.subject) {
        form.value.subject = String(q.subject)
        form.value.subject_mode = 'equals'
      }
    }
  } finally {
    loading.value = false
  }
})

const save = async () => {
  saving.value = true
  try {
    const data = {
      ...form.value,
      iban: form.value.iban || null,
      min_amount: useMin.value ? form.value.min_amount : null,
      max_amount: useMax.value ? form.value.max_amount : null,
      subject: form.value.subject || null,
    }

    if (isEdit.value) {
      await p4xService.updateCategoryFilter(Number(route.params.id), data)
      toast.add({ severity: 'success', summary: 'Gespeichert', life: 2000 })
    } else {
      await p4xService.createCategoryFilter(data)
      toast.add({ severity: 'success', summary: 'Filter erstellt', life: 2000 })
    }
    router.push({ name: 'p4x-filters' })
  } catch (e: unknown) {
    const msg = formatApiError(e)
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  } finally {
    saving.value = false
  }
}

const deleteFilter = async () => {
  try {
    await p4xService.deleteCategoryFilter(Number(route.params.id))
    toast.add({ severity: 'success', summary: 'Gelöscht', life: 2000 })
    router.push({ name: 'p4x-filters' })
  } catch (e: unknown) {
    const msg = formatApiError(e)
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  }
}
</script>

<template>
  <div v-if="!loading" class="filter-form">
    <h2>Kategorie-Filter</h2>
    <p class="subtitle">
      {{ isEdit ? 'Filter bearbeiten' : 'Filter erstellen' }}
    </p>

    <div class="form-grid">
      <div class="section-title">Filtername</div>
      <div class="field">
        <InputText v-model="form.name" :maxlength="64" class="w-full" />
      </div>

      <div class="section-title">Filterparameter</div>
      <div class="field">
        <label>Konto</label>
        <Select
          v-model="form.p4x_account_id"
          :options="accountOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>
      <div class="field">
        <label>IBAN Gegenstelle</label>
        <InputText v-model="form.iban" :maxlength="25" class="w-full" />
      </div>
      <div class="amount-row">
        <div class="field">
          <Checkbox v-model="useMin" :binary="true" input-id="use-min" />
          <label for="use-min">Minimalbetrag</label>
          <FormAmount v-if="useMin" v-model="form.min_amount" />
        </div>
        <div class="field">
          <Checkbox v-model="useMax" :binary="true" input-id="use-max" />
          <label for="use-max">Maximalbetrag</label>
          <FormAmount v-if="useMax" v-model="form.max_amount" />
        </div>
      </div>
      <div class="condition-row">
        <div class="field">
          <label>Bedingung Betreff</label>
          <Select
            v-model="form.subject_mode"
            :options="subjectModeOptions"
            option-label="label"
            option-value="value"
          />
        </div>
        <div class="field field-grow">
          <label>Betreff</label>
          <InputText v-model="form.subject" :maxlength="400" class="w-full" />
        </div>
      </div>

      <div class="section-title">Kategorie-Zuweisung</div>
      <div class="field">
        <Select
          v-model="form.p4x_category_id"
          :options="categoryOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>
    </div>

    <div class="actions">
      <Button label="Speichern" :loading="saving" @click="save" />
      <Button v-if="isEdit" label="Löschen" severity="danger" @click="deleteFilter" />
      <Button
        label="Zur Liste"
        severity="secondary"
        @click="router.push({ name: 'p4x-filters' })"
      />
    </div>
  </div>
</template>

<style scoped>
.filter-form {
  max-width: 700px;
  margin: 0 auto;
}
.subtitle {
  color: var(--p-text-muted-color);
  margin: 0 0 1.5rem;
}
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 0.5rem;
}
.field label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.2rem;
  font-size: 0.85rem;
}
.w-full {
  width: 100%;
}
.amount-row,
.condition-row {
  display: flex;
  gap: 1rem;
}
.amount-row .field,
.condition-row .field {
  flex: 1;
}
.field-grow {
  flex: 2 !important;
}
.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.5rem;
  justify-content: center;
}
</style>
