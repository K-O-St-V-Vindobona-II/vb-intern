<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import standesdbService from '@/services/standesdbService'
import { getApiErrorDetail } from '@/utils/formatters'
import type {
  ContactDetail,
  ContactFormData,
  ReferenceData,
  ApiValidationErrorItem,
} from '@/types/standesdb'
import FuzzyDatePicker from '@/components/standesdb/FuzzyDatePicker.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const errors = ref<Record<string, string>>({})
const refs = ref<ReferenceData | null>(null)

const isNew = computed(() => route.name === 'standesdb-contact-new')
const contactId = computed(() => (isNew.value ? null : Number(route.params.id)))

const form = ref<ContactFormData>({
  kontakttyp: 'person',
  anrede: null,
  name: '',
  couleurname: null,
  org_id: null,
  adresse_anschrift: null,
  adresse_plz: null,
  adresse_ort: null,
  adresse_land: null,
  zustellungen: false,
  email: null,
  rufnummer: null,
  datum: null,
  datum_accuracy: 0,
  anmerkungen: null,
})

const kontakttypOptions = [
  { label: 'Person', value: 'person' },
  { label: 'Organisation', value: 'organisation' },
]

const copyField = <K extends keyof ContactFormData>(key: K, data: ContactDetail) => {
  form.value[key] = data[key]
}

onMounted(async () => {
  try {
    const refResp = await standesdbService.getReferenceData()
    refs.value = refResp.data

    if (!isNew.value && contactId.value) {
      const resp = await standesdbService.getContact(contactId.value)
      const data = resp.data as ContactDetail
      ;(Object.keys(form.value) as (keyof ContactFormData)[]).forEach((key) => {
        if (key in data) {
          copyField(key, data)
        }
      })
    }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404 || status === 403) {
      router.replace({ name: 'not-found' })
      return
    }
  } finally {
    loading.value = false
  }
})

const save = async () => {
  saving.value = true
  errors.value = {}

  try {
    if (isNew.value) {
      const resp = await standesdbService.createContact(form.value)
      toast.add({
        severity: 'success',
        summary: 'Gespeichert',
        detail: 'Kontakt wurde angelegt.',
        life: 3000,
      })
      router.push({
        name: 'standesdb-contact-show',
        params: { id: resp.data.id },
      })
    } else {
      await standesdbService.updateContact(contactId.value!, form.value)
      toast.add({
        severity: 'success',
        summary: 'Gespeichert',
        detail: 'Änderungen wurden übernommen.',
        life: 3000,
      })
      router.push({
        name: 'standesdb-contact-show',
        params: { id: contactId.value! },
      })
    }
  } catch (err: unknown) {
    const detail = getApiErrorDetail(err) ?? 'Fehler'
    if (typeof detail === 'string') {
      toast.add({
        severity: 'error',
        summary: 'Fehler',
        detail,
        life: 5000,
      })
    } else if (Array.isArray(detail)) {
      const stringErrors = detail.filter((e): e is string => typeof e === 'string')
      const fieldErrors = detail.filter(
        (e): e is ApiValidationErrorItem =>
          typeof e === 'object' && Boolean((e as ApiValidationErrorItem | null)?.loc),
      )

      fieldErrors.forEach((e) => {
        const loc = e.loc ?? []
        const field = loc[loc.length - 1] ?? ''
        errors.value[field] = e.msg ?? ''
      })

      const allMessages = [
        ...stringErrors,
        ...Object.entries(errors.value).map(([k, v]) => `${k}: ${v}`),
      ]

      if (allMessages.length) {
        toast.add({
          severity: 'error',
          summary: 'Validierungsfehler',
          detail: allMessages.join('\n'),
          life: 8000,
        })
      }

      stringErrors.forEach((msg: string, i: number) => {
        errors.value[`validation_${i}`] = msg
      })
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="contact-edit">
    <template v-if="!loading">
      <div class="page-header">
        <h2 class="page-title">Standesdatenbank</h2>
        <h3 class="page-subtitle">
          {{ isNew ? 'Neuen Kontakt anlegen' : 'Kontakt bearbeiten' }}
        </h3>
        <div class="header-actions">
          <Button label="Zurück" icon="pi pi-arrow-left" text size="small" @click="router.back()" />
          <Button
            label="Speichern"
            icon="pi pi-check"
            severity="danger"
            size="small"
            :loading="saving"
            @click="save"
          />
        </div>
      </div>

      <div class="two-col">
        <!-- LINKE SPALTE -->
        <div class="col">
          <div class="field">
            <label>Kontakttyp</label>
            <Select
              v-model="form.kontakttyp"
              :options="kontakttypOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>

          <div class="field">
            <label>Anrede</label>
            <InputText v-model="form.anrede" class="w-full" />
          </div>

          <div class="field">
            <label>Name</label>
            <InputText v-model="form.name" class="w-full" />
            <small v-if="errors.name" class="p-error">{{ errors.name }}</small>
          </div>

          <div class="field">
            <label>Couleurname</label>
            <InputText v-model="form.couleurname" class="w-full" />
          </div>

          <div class="field field--check">
            <label>
              <Checkbox v-model="form.zustellungen" :binary="true" />
              Zustellungen
            </label>
          </div>

          <label class="section-label">Adresse</label>
          <div class="field">
            <label>Adresse (Anschrift)</label>
            <InputText v-model="form.adresse_anschrift" class="w-full" />
          </div>
          <div class="field">
            <label>Adresse (PLZ)</label>
            <InputText v-model="form.adresse_plz" class="w-full" />
          </div>
          <div class="field">
            <label>Adresse (Ort)</label>
            <InputText v-model="form.adresse_ort" class="w-full" />
          </div>
          <div class="field">
            <label>Adresse (Land)</label>
            <InputText v-model="form.adresse_land" class="w-full" />
          </div>
        </div>

        <!-- RECHTE SPALTE -->
        <div class="col">
          <div class="field">
            <label>E-Mail</label>
            <InputText v-model="form.email" type="email" class="w-full" />
          </div>

          <div class="field">
            <label>Rufnummer</label>
            <InputText v-model="form.rufnummer" class="w-full" />
          </div>

          <FuzzyDatePicker
            label="Datum"
            :date="form.datum"
            :accuracy="form.datum_accuracy"
            @update:date="form.datum = $event"
            @update:accuracy="form.datum_accuracy = $event"
          />

          <div class="field">
            <label>Anmerkungen</label>
            <Textarea v-model="form.anmerkungen" rows="3" class="w-full" />
          </div>

          <div v-if="refs" class="field">
            <label>Verbindung (Referenz)</label>
            <Select
              v-model="form.org_id"
              :options="refs.orgs"
              option-label="label"
              option-value="id"
              class="w-full"
              show-clear
            />
          </div>
        </div>
      </div>

      <Message
        v-if="Object.keys(errors).length"
        severity="error"
        :closable="false"
        style="margin-top: 1rem"
      >
        <div>
          <strong>Validierungsfehler:</strong>
          <ul style="margin: 0.25rem 0 0; padding-left: 1.25rem">
            <li v-for="(msg, field) in errors" :key="field">
              <strong>{{ field }}:</strong> {{ msg }}
            </li>
          </ul>
        </div>
      </Message>

      <div class="footer-actions">
        <Button label="Zurück" icon="pi pi-arrow-left" text size="small" @click="router.back()" />
        <Button
          label="Speichern"
          icon="pi pi-check"
          severity="danger"
          size="small"
          :loading="saving"
          @click="save"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.contact-edit {
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
}

.page-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.page-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
}

.page-subtitle {
  margin: 0.25rem 0 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.header-actions,
.footer-actions {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.footer-actions {
  margin-top: 2rem;
  padding-bottom: 2rem;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  margin-top: 1.5rem;
}

.col {
  min-width: 0;
}

.field {
  min-width: 0;
  margin-bottom: 0.85rem;
}

.field label {
  display: block;
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.3rem;
}

.field--check {
  padding: 0.2rem 0;
}

.field--check label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: var(--p-text-color);
}

.section-label {
  display: block;
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--p-text-color);
  margin-bottom: 0.5rem;
  margin-top: 1.25rem;
}

.w-full {
  width: 100%;
}

@media (min-width: 768px) {
  .two-col {
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem 2rem;
  }
}
</style>
