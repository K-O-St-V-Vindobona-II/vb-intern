<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'primevue/usetoast'
import standesdbService from '@/services/standesdbService'
import { getApiErrorDetail, getApiErrorStatus, formatFullDate } from '@/utils/formatters'
import type {
  MemberSelfServiceFormData,
  MemberSelfServiceDetail,
  ApiValidationErrorItem,
} from '@/types/standesdb'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'

const authStore = useAuthStore()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const errors = ref<Record<string, string>>({})
const pendingSince = ref<string | null>(null)

const form = ref<MemberSelfServiceFormData>({
  vortitel: null,
  vorname: null,
  nachname: null,
  nachname_geburt: null,
  nachtitel: null,
  couleurname: null,
  email: null,
  url: null,
  mkv_ogv_url: null,
  rufnummer_mobil: null,
  rufnummer_privat: null,
  rufnummer_beruf: null,
  zustellungen: 'deaktiviert',
  adresse_privat_anschrift: null,
  adresse_privat_plz: null,
  adresse_privat_ort: null,
  adresse_privat_land: null,
  adresse_beruf_anschrift: null,
  adresse_beruf_plz: null,
  adresse_beruf_ort: null,
  adresse_beruf_land: null,
  arbeitgeber: null,
  taetigkeit: null,
  mitgliedschaften: null,
  verbandchargen: null,
})

const zustellungOptions = [
  { label: 'Privatadresse', value: 'adresse_privat' },
  { label: 'Berufsadresse', value: 'adresse_beruf' },
  { label: 'Deaktiviert', value: 'deaktiviert' },
]

// MemberSelfServiceDetail extends MemberSelfServiceFormData 1:1 (plus
// id/cn), so every form key exists on it with the exact same type - no
// cast needed here, same pattern as MemberEditView.vue's copyField.
const copyField = <K extends keyof MemberSelfServiceFormData>(
  key: K,
  data: MemberSelfServiceDetail,
) => {
  form.value[key] = data[key]
}

// proposed_fields crosses a genuinely dynamic JSON boundary (the backend
// only guarantees, per field, that the value matches that field's real
// type - not expressible as a single TS union without a cast at this one
// well-contained point).
const overlayProposedField = <K extends keyof MemberSelfServiceFormData>(
  key: K,
  value: string | number | null,
) => {
  form.value[key] = value as MemberSelfServiceFormData[K]
}

onMounted(async () => {
  try {
    const liveResp = await standesdbService.getMySelfServiceData()
    ;(Object.keys(form.value) as (keyof MemberSelfServiceFormData)[]).forEach((key) => {
      copyField(key, liveResp.data)
    })

    try {
      const pendingResp = await standesdbService.getMyChangeRequest()
      pendingSince.value = pendingResp.data.created_at
      ;(Object.keys(form.value) as (keyof MemberSelfServiceFormData)[]).forEach((key) => {
        const proposedValue = pendingResp.data.proposed_fields[key]
        if (proposedValue !== undefined) {
          overlayProposedField(key, proposedValue)
        }
      })
    } catch (err: unknown) {
      if (getApiErrorStatus(err) !== 404) throw err
    }
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: 'Stammdaten konnten nicht geladen werden.',
      life: 5000,
    })
  } finally {
    loading.value = false
  }
})

const submit = async () => {
  saving.value = true
  errors.value = {}

  try {
    const resp = await standesdbService.submitMyChangeRequest(form.value)
    if (resp.data.status === 'no_changes') {
      toast.add({
        severity: 'info',
        summary: 'Keine Änderungen',
        detail: 'Es wurden keine Änderungen gegenüber deinen aktuellen Daten erkannt.',
        life: 4000,
      })
      pendingSince.value = null
    } else {
      pendingSince.value = new Date().toISOString()
      toast.add({
        severity: 'success',
        summary: 'Antrag eingereicht',
        detail: 'Deine Änderungen warten auf Freigabe durch die Standesführung.',
        life: 5000,
      })
    }
  } catch (err: unknown) {
    const detail = getApiErrorDetail(err) ?? 'Fehler'
    if (typeof detail === 'string') {
      toast.add({ severity: 'error', summary: 'Fehler', detail, life: 5000 })
    } else if (Array.isArray(detail)) {
      const fieldErrors = detail.filter(
        (e): e is ApiValidationErrorItem =>
          typeof e === 'object' && Boolean((e as ApiValidationErrorItem | null)?.loc),
      )
      fieldErrors.forEach((e) => {
        const loc = e.loc ?? []
        const field = loc[loc.length - 1] ?? ''
        errors.value[field] = e.msg ?? ''
      })
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="my-stammdaten">
    <template v-if="!loading">
      <div class="page-header">
        <h2 class="page-title">Meine Stammdaten</h2>
        <p class="page-subtitle">
          Änderungen werden erst nach Freigabe durch die Standesführung wirksam.
        </p>
      </div>

      <Message v-if="pendingSince" severity="info" :closable="false" class="pending-banner">
        Antrag eingereicht am {{ formatFullDate(pendingSince.slice(0, 10)) }}, wartet auf Freigabe.
      </Message>

      <div class="two-col">
        <div class="col">
          <div class="field-pair">
            <div class="field">
              <label>Vortitel</label>
              <InputText v-model="form.vortitel" class="w-full" />
            </div>
            <div class="field">
              <label>Vorname</label>
              <InputText v-model="form.vorname" class="w-full" />
            </div>
          </div>

          <div class="field-pair">
            <div class="field">
              <label>Nachname</label>
              <InputText v-model="form.nachname" class="w-full" />
              <small v-if="errors['nachname']" class="p-error">{{ errors['nachname'] }}</small>
            </div>
            <div class="field">
              <label>Nachtitel</label>
              <InputText v-model="form.nachtitel" class="w-full" />
            </div>
          </div>

          <div class="field-pair">
            <div class="field">
              <label>Couleurname</label>
              <InputText v-model="form.couleurname" class="w-full" />
            </div>
            <div class="field">
              <label>Geburtsname</label>
              <InputText v-model="form.nachname_geburt" class="w-full" />
            </div>
          </div>

          <div class="field">
            <label>Zustellung</label>
            <Select
              v-model="form.zustellungen"
              :options="zustellungOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>

          <label class="section-label">Privatadresse</label>
          <div class="field">
            <label>Anschrift</label>
            <InputText v-model="form.adresse_privat_anschrift" class="w-full" />
          </div>
          <div class="field">
            <label>PLZ</label>
            <InputText v-model="form.adresse_privat_plz" class="w-full" />
          </div>
          <div class="field">
            <label>Ort</label>
            <InputText v-model="form.adresse_privat_ort" class="w-full" />
          </div>
          <div class="field">
            <label>Land</label>
            <InputText v-model="form.adresse_privat_land" class="w-full" />
          </div>

          <label class="section-label">Berufsadresse</label>
          <div class="field">
            <label>Anschrift</label>
            <InputText v-model="form.adresse_beruf_anschrift" class="w-full" />
          </div>
          <div class="field">
            <label>PLZ</label>
            <InputText v-model="form.adresse_beruf_plz" class="w-full" />
          </div>
          <div class="field">
            <label>Ort</label>
            <InputText v-model="form.adresse_beruf_ort" class="w-full" />
          </div>
          <div class="field">
            <label>Land</label>
            <InputText v-model="form.adresse_beruf_land" class="w-full" />
          </div>
        </div>

        <div class="col">
          <div class="field">
            <label>E-Mail</label>
            <InputText v-model="form.email" type="email" class="w-full" />
            <small v-if="errors['email']" class="p-error">{{ errors['email'] }}</small>
          </div>

          <div class="field">
            <label>URI</label>
            <InputText v-model="form.url" class="w-full" />
          </div>

          <div v-if="authStore.user?.org_id === 'vbw'" class="field">
            <label>MKV/OGV-Link</label>
            <InputText v-model="form.mkv_ogv_url" class="w-full" />
          </div>

          <div class="field">
            <label>Rufnummer (mobil)</label>
            <InputText v-model="form.rufnummer_mobil" class="w-full" />
          </div>

          <div class="field">
            <label>Rufnummer (privat)</label>
            <InputText v-model="form.rufnummer_privat" class="w-full" />
          </div>

          <div class="field">
            <label>Rufnummer (beruflich)</label>
            <InputText v-model="form.rufnummer_beruf" class="w-full" />
          </div>

          <div class="field">
            <label>Arbeitgeber</label>
            <InputText v-model="form.arbeitgeber" class="w-full" />
          </div>

          <div class="field">
            <label>Tätigkeit</label>
            <InputText v-model="form.taetigkeit" class="w-full" />
          </div>

          <div class="field">
            <label>Weitere Mitgliedschaften</label>
            <Textarea v-model="form.mitgliedschaften" rows="2" class="w-full" />
          </div>

          <div class="field">
            <label>Verbandschargen</label>
            <Textarea v-model="form.verbandchargen" rows="2" class="w-full" />
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
        <Button
          label="Antrag einreichen"
          icon="pi pi-check"
          severity="danger"
          size="small"
          :loading="saving"
          @click="submit"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.my-stammdaten {
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
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

.pending-banner {
  margin-top: 1rem;
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

.field-pair {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
}

.field-pair > * {
  min-width: 0;
}

.section-label {
  display: block;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--p-text-color);
  margin-bottom: 0.75rem;
  margin-top: 1.25rem;
}

.section-label:first-child {
  margin-top: 0;
}

.w-full {
  width: 100%;
}

.footer-actions {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 2rem;
  padding-bottom: 2rem;
}

@media (min-width: 768px) {
  .two-col {
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem 2rem;
  }
  .field-pair {
    grid-template-columns: 1fr 1fr;
    gap: 0 1.25rem;
  }
}
</style>
