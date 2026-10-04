<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import standesdbService from '@/services/standesdbService'
import { getApiErrorDetail, getApiErrorStatus, trimmedOrNull } from '@/utils/formatters'
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

// Length limits of the API's ContactSaveRequest; typing past them only ends in a 422.
const MAX_NAME = 64
const MAX_SALUTATION = 32
const MAX_POSTAL_CODE = 8
const MAX_PLACE = 32
const MAX_EMAIL = 128

// German labels for the field names the API reports in a validation error.
const FIELD_LABELS: Record<string, string> = {
  kontakttyp: 'Kontakttyp',
  anrede: 'Anrede',
  name: 'Name',
  couleurname: 'Couleurname',
  org_id: 'Verbindung (Referenz)',
  adresse_anschrift: 'Adresse (Anschrift)',
  adresse_plz: 'Adresse (PLZ)',
  adresse_ort: 'Adresse (Ort)',
  adresse_land: 'Adresse (Land)',
  zustellungen: 'Zustellungen',
  email: 'E-Mail',
  rufnummer: 'Rufnummer',
  datum: 'Datum',
  datum_accuracy: 'Datum',
  anmerkungen: 'Anmerkungen',
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(true)
const loadFailed = ref(false)
const saving = ref(false)
const errors = ref<Record<string, string>>({})
const generalErrors = ref<string[]>([])
const refs = ref<ReferenceData | null>(null)
// Numbers each load so that the answer of an earlier one can be recognised and dropped.
let loadRequestId = 0

const isNew = computed(() => route.name === 'standesdb-contact-new')
const contactId = computed(() => (isNew.value ? null : String(route.params['id'])))

const emptyForm = (): ContactFormData => ({
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

const form = ref<ContactFormData>(emptyForm())

const kontakttypOptions = [
  { label: 'Person', value: 'person' },
  { label: 'Organisation', value: 'organisation' },
]

const hasErrors = computed(
  () => Object.keys(errors.value).length > 0 || generalErrors.value.length > 0,
)
const errorLines = computed(() => [
  ...generalErrors.value,
  ...Object.entries(errors.value).map(([field, msg]) => `${FIELD_LABELS[field] ?? field}: ${msg}`),
])

const copyField = <K extends keyof ContactFormData>(key: K, data: ContactDetail) => {
  form.value[key] = data[key]
}

const fillForm = (data: ContactDetail) => {
  ;(Object.keys(form.value) as (keyof ContactFormData)[]).forEach((key) => {
    if (key in data) {
      copyField(key, data)
    }
  })
}

const fetchFormData = (id: string | null) =>
  Promise.all([
    standesdbService.getReferenceData(),
    id ? standesdbService.getContact(id) : Promise.resolve(null),
  ])

const failLoad = (err: unknown) => {
  const status = getApiErrorStatus(err)
  if (status === 404 || status === 403) {
    router.replace({ name: 'not-found' })
    return
  }
  loadFailed.value = true
}

// Loads the reference data and, when editing, the contact. A failed load never
// leaves a blank form behind for an existing contact: saving that form would
// overwrite the stored data with empty values.
const loadForm = async () => {
  const thisRequest = ++loadRequestId
  loading.value = true
  loadFailed.value = false
  errors.value = {}
  generalErrors.value = []
  form.value = emptyForm()
  try {
    const [refResp, contactResp] = await fetchFormData(contactId.value)
    if (thisRequest !== loadRequestId) return
    refs.value = refResp.data
    if (contactResp) fillForm(contactResp.data)
  } catch (err: unknown) {
    if (thisRequest !== loadRequestId) return
    failLoad(err)
  } finally {
    if (thisRequest === loadRequestId) loading.value = false
  }
}

watch(() => [route.name, route.params['id']], loadForm, { immediate: true })

// A cleared PrimeVue input holds "", which the API rejects for the e-mail
// address and would otherwise store as an empty string instead of NULL.
const toPayload = (): ContactFormData => ({
  ...form.value,
  anrede: trimmedOrNull(form.value.anrede),
  name: form.value.name.trim(),
  couleurname: trimmedOrNull(form.value.couleurname),
  adresse_anschrift: trimmedOrNull(form.value.adresse_anschrift),
  adresse_plz: trimmedOrNull(form.value.adresse_plz),
  adresse_ort: trimmedOrNull(form.value.adresse_ort),
  adresse_land: trimmedOrNull(form.value.adresse_land),
  email: trimmedOrNull(form.value.email),
  rufnummer: trimmedOrNull(form.value.rufnummer),
  anmerkungen: trimmedOrNull(form.value.anmerkungen),
})

const showError = (summary: string, detail: string, life = 5000) => {
  toast.add({ severity: 'error', summary, detail, life })
}

const applyValidationErrors = (detail: unknown[]) => {
  const fieldErrors: Record<string, string> = {}
  const general: string[] = []
  detail.forEach((item) => {
    if (typeof item === 'string') {
      general.push(item)
      return
    }
    const loc = (item as ApiValidationErrorItem | null)?.loc
    const field = loc?.[loc.length - 1]
    if (!field) return
    fieldErrors[field] = ((item as ApiValidationErrorItem).msg ?? '').replace(/^Value error, /, '')
  })
  errors.value = fieldErrors
  generalErrors.value = general
  if (hasErrors.value) showError('Validierungsfehler', errorLines.value.join('\n'), 8000)
}

const handleSaveError = (err: unknown) => {
  const detail = getApiErrorDetail(err)
  if (Array.isArray(detail)) {
    applyValidationErrors(detail)
    return
  }
  showError('Fehler', typeof detail === 'string' ? detail : 'Speichern fehlgeschlagen.')
}

const toastSaved = (detail: string) => {
  toast.add({ severity: 'success', summary: 'Gespeichert', detail, life: 3000 })
}

const createContact = async () => {
  const resp = await standesdbService.createContact(toPayload())
  toastSaved('Kontakt wurde angelegt.')
  router.push({ name: 'standesdb-contact-show', params: { id: resp.data.id } })
}

const updateContact = async (id: string) => {
  await standesdbService.updateContact(id, toPayload())
  toastSaved('Änderungen wurden übernommen.')
  router.push({ name: 'standesdb-contact-show', params: { id } })
}

const save = async () => {
  saving.value = true
  errors.value = {}
  generalErrors.value = []
  try {
    const id = contactId.value
    if (id) await updateContact(id)
    else await createContact()
  } catch (err: unknown) {
    handleSaveError(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="contact-edit">
    <div v-if="loadFailed" class="load-error">
      <Message severity="error" :closable="false">
        {{
          isNew
            ? 'Das Formular konnte nicht geladen werden.'
            : 'Der Kontakt konnte nicht geladen werden.'
        }}
      </Message>
      <Button label="Erneut versuchen" icon="pi pi-refresh" size="small" @click="loadForm" />
    </div>

    <template v-else-if="!loading">
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
        <!-- left column -->
        <div class="col">
          <div class="field">
            <label for="contact-kontakttyp">Kontakttyp</label>
            <Select
              v-model="form.kontakttyp"
              input-id="contact-kontakttyp"
              :options="kontakttypOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>

          <div class="field">
            <label for="contact-anrede">Anrede</label>
            <InputText
              id="contact-anrede"
              v-model="form.anrede"
              :maxlength="MAX_SALUTATION"
              class="w-full"
            />
          </div>

          <div class="field">
            <label for="contact-name">Name</label>
            <InputText
              id="contact-name"
              v-model="form.name"
              :maxlength="MAX_NAME"
              :invalid="Boolean(errors['name'])"
              class="w-full"
            />
            <Message v-if="errors['name']" severity="error" size="small" variant="simple">
              {{ errors['name'] }}
            </Message>
          </div>

          <div class="field">
            <label for="contact-couleurname">Couleurname</label>
            <InputText
              id="contact-couleurname"
              v-model="form.couleurname"
              :maxlength="MAX_NAME"
              class="w-full"
            />
          </div>

          <div class="field field--check">
            <label>
              <Checkbox v-model="form.zustellungen" :binary="true" />
              Zustellungen
            </label>
          </div>

          <span class="section-label">Adresse</span>
          <div class="field">
            <label for="contact-adresse-anschrift">Adresse (Anschrift)</label>
            <InputText
              id="contact-adresse-anschrift"
              v-model="form.adresse_anschrift"
              class="w-full"
            />
          </div>
          <div class="field">
            <label for="contact-adresse-plz">Adresse (PLZ)</label>
            <InputText
              id="contact-adresse-plz"
              v-model="form.adresse_plz"
              :maxlength="MAX_POSTAL_CODE"
              class="w-full"
            />
          </div>
          <div class="field">
            <label for="contact-adresse-ort">Adresse (Ort)</label>
            <InputText
              id="contact-adresse-ort"
              v-model="form.adresse_ort"
              :maxlength="MAX_PLACE"
              class="w-full"
            />
          </div>
          <div class="field">
            <label for="contact-adresse-land">Adresse (Land)</label>
            <InputText
              id="contact-adresse-land"
              v-model="form.adresse_land"
              :maxlength="MAX_PLACE"
              class="w-full"
            />
          </div>
        </div>

        <!-- right column -->
        <div class="col">
          <div class="field">
            <label for="contact-email">E-Mail</label>
            <InputText
              id="contact-email"
              v-model="form.email"
              type="email"
              :maxlength="MAX_EMAIL"
              :invalid="Boolean(errors['email'])"
              class="w-full"
            />
            <Message v-if="errors['email']" severity="error" size="small" variant="simple">
              {{ errors['email'] }}
            </Message>
          </div>

          <div class="field">
            <label for="contact-rufnummer">Rufnummer</label>
            <InputText id="contact-rufnummer" v-model="form.rufnummer" class="w-full" />
          </div>

          <FuzzyDatePicker
            label="Datum"
            :date="form.datum"
            :accuracy="form.datum_accuracy"
            @update:date="form.datum = $event"
            @update:accuracy="form.datum_accuracy = $event"
          />

          <div class="field">
            <label for="contact-anmerkungen">Anmerkungen</label>
            <Textarea id="contact-anmerkungen" v-model="form.anmerkungen" rows="3" class="w-full" />
          </div>

          <div v-if="refs" class="field">
            <label for="contact-org">Verbindung (Referenz)</label>
            <Select
              v-model="form.org_id"
              input-id="contact-org"
              :options="refs.orgs"
              option-label="label"
              option-value="id"
              class="w-full"
              show-clear
            />
          </div>
        </div>
      </div>

      <Message v-if="hasErrors" severity="error" :closable="false" class="error-summary">
        <strong>Validierungsfehler:</strong>
        <ul class="error-list">
          <li v-for="line in errorLines" :key="line">{{ line }}</li>
        </ul>
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

.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
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

.error-summary {
  margin-top: 1rem;
}

.error-list {
  margin: 0.25rem 0 0;
  padding-left: 1.25rem;
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
