<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'primevue/usetoast'
import standesdbService from '@/services/standesdbService'
import { getApiErrorDetail } from '@/utils/formatters'
import type {
  MemberDetail,
  MemberFormData,
  ReferenceData,
  ApiValidationErrorItem,
} from '@/types/standesdb'
import FuzzyDatePicker from '@/components/standesdb/FuzzyDatePicker.vue'
import ParentSelector from '@/components/standesdb/ParentSelector.vue'
import SetEditor from '@/components/standesdb/SetEditor.vue'
import RolesHistoryEditor from '@/components/standesdb/RolesHistoryEditor.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const errors = ref<Record<string, string>>({})
const refs = ref<ReferenceData | null>(null)

const isNew = computed(() => route.name === 'standesdb-member-new')
const memberId = computed(() => (isNew.value ? null : Number(route.params.id)))

const form = ref<MemberFormData>({
  vortitel: null,
  vorname: null,
  nachname: null,
  nachname_geburt: null,
  nachtitel: null,
  couleurname: null,
  org_id: authStore.user?.org_id ?? 'vbw',
  state_id: null,
  gruender: false,
  entlassen: false,
  verstorben: false,
  parent_id: 0,
  parent_cn: '',
  grabadresse: null,
  geburtsdatum: null,
  geburtsdatum_accuracy: 0,
  aufnahmedatum: null,
  aufnahmedatum_accuracy: 0,
  branderdatum: null,
  branderdatum_accuracy: 0,
  burschungsdatum: null,
  burschungsdatum_accuracy: 0,
  philistrierungsdatum: null,
  philistrierungsdatum_accuracy: 0,
  entlassungsdatum: null,
  entlassungsdatum_accuracy: 0,
  sterbedatum: null,
  sterbedatum_accuracy: 0,
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
  anmerkungen: null,
  chroniclemail: false,
  auth_locked: true,
  roles_history: [],
  badges: [],
  keys: [],
})

const allowedOrgs = computed(() => {
  if (!refs.value) return []
  const perms = authStore.user?.permissions ?? []
  return refs.value.orgs.filter((o) => {
    const cap = o.id.charAt(0).toUpperCase() + o.id.slice(1)
    return perms.includes(`standesdb${cap}Admin`)
  })
})

const zustellungOptions = [
  { label: 'Privatadresse', value: 'adresse_privat' },
  { label: 'Berufsadresse', value: 'adresse_beruf' },
  { label: 'Deaktiviert', value: 'deaktiviert' },
]

const fuzzyDateFields: {
  key:
    | 'geburtsdatum'
    | 'aufnahmedatum'
    | 'branderdatum'
    | 'burschungsdatum'
    | 'philistrierungsdatum'
  label: string
}[] = [
  { key: 'geburtsdatum', label: 'Geburtsdatum' },
  { key: 'aufnahmedatum', label: 'Aufnahmedatum' },
  { key: 'branderdatum', label: 'Branderdatum' },
  {
    key: 'burschungsdatum',
    label: 'Burschungsdatum',
  },
  {
    key: 'philistrierungsdatum',
    label: 'Philistrierungsdatum',
  },
]

const copyField = <K extends keyof MemberFormData>(key: K, data: MemberDetail) => {
  form.value[key] = data[key]
}

onMounted(async () => {
  try {
    const refResp = await standesdbService.getReferenceData()
    refs.value = refResp.data

    if (!isNew.value && memberId.value) {
      const resp = await standesdbService.getMember(memberId.value)
      const data = resp.data as MemberDetail
      ;(Object.keys(form.value) as (keyof MemberFormData)[]).forEach((key) => {
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

const buildPayload = () => {
  const { parent_cn: _parent_cn, ...payload } = form.value
  return payload
}

const save = async () => {
  saving.value = true
  errors.value = {}

  try {
    if (isNew.value) {
      const resp = await standesdbService.createMember(buildPayload())
      toast.add({
        severity: 'success',
        summary: 'Gespeichert',
        detail: 'Mitglied wurde angelegt.',
        life: 3000,
      })
      router.push({
        name: 'standesdb-member-show',
        params: { id: resp.data.id },
      })
    } else {
      await standesdbService.updateMember(memberId.value!, buildPayload())
      toast.add({
        severity: 'success',
        summary: 'Gespeichert',
        detail: 'Änderungen wurden übernommen.',
        life: 3000,
      })
      router.push({
        name: 'standesdb-member-show',
        params: { id: memberId.value! },
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
        errors.value[`roles_history_${i}`] = msg
      })
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="member-edit">
    <template v-if="!loading">
      <div class="page-header">
        <h2 class="page-title">Standesdatenbank</h2>
        <h3 class="page-subtitle">
          {{ isNew ? 'Neues Mitglied anlegen' : 'Mitglied bearbeiten' }}
        </h3>
        <div class="header-actions">
          <Button label="Abbrechen" icon="pi pi-times" text size="small" @click="router.back()" />
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

      <!-- Zwei-Spalten-Layout wie ShowView -->
      <div class="two-col">
        <!-- LINKE SPALTE -->
        <div class="col">
          <div v-if="refs" class="field">
            <label>Organisation</label>
            <Select
              v-model="form.org_id"
              :options="allowedOrgs"
              option-label="label"
              option-value="id"
              :disabled="!isNew"
              class="w-full"
            />
          </div>

          <div class="field field--check">
            <label>
              <Checkbox v-model="form.gruender" :binary="true" />
              Gründer
            </label>
          </div>

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
              <small v-if="errors.nachname" class="p-error">{{ errors.nachname }}</small>
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

          <div v-if="refs" class="field">
            <label>Status</label>
            <Select
              v-model="form.state_id"
              :options="refs.states"
              option-label="label"
              option-value="id"
              class="w-full"
              show-clear
            />
          </div>

          <div class="status-section">
            <div class="field field--check">
              <label>
                <Checkbox v-model="form.entlassen" :binary="true" />
                Entlassen
              </label>
            </div>
            <FuzzyDatePicker
              v-if="form.entlassen"
              label="Entlassungsdatum"
              :date="form.entlassungsdatum"
              :accuracy="form.entlassungsdatum_accuracy"
              @update:date="form.entlassungsdatum = $event"
              @update:accuracy="form.entlassungsdatum_accuracy = $event"
            />

            <div class="field field--check">
              <label>
                <Checkbox v-model="form.verstorben" :binary="true" />
                Verstorben
              </label>
            </div>
            <FuzzyDatePicker
              v-if="form.verstorben"
              label="Sterbedatum"
              :date="form.sterbedatum"
              :accuracy="form.sterbedatum_accuracy"
              @update:date="form.sterbedatum = $event"
              @update:accuracy="form.sterbedatum_accuracy = $event"
            />
            <div v-if="form.verstorben" class="field">
              <label>Grabadresse</label>
              <InputText v-model="form.grabadresse" class="w-full" />
            </div>
          </div>

          <ParentSelector
            label="Leibbursch"
            :parent-id="form.parent_id"
            :parent-cn="form.parent_cn"
            :member-id="memberId"
            :readonly="false"
            @update:parent-id="form.parent_id = $event"
            @update:parent-cn="form.parent_cn = $event"
          />

          <FuzzyDatePicker
            v-for="fd in fuzzyDateFields"
            :key="fd.key"
            :label="fd.label"
            :date="form[fd.key]"
            :accuracy="form[`${fd.key}_accuracy`]"
            @update:date="form[fd.key] = $event"
            @update:accuracy="form[`${fd.key}_accuracy`] = $event"
          />

          <SetEditor
            v-if="refs"
            title="Ehrungen"
            :model-value="form.badges"
            :available-items="refs.badges"
            :with-group="true"
            :with-date="true"
            @update:model-value="form.badges = $event"
          />

          <SetEditor
            v-if="refs"
            title="Schlüssel"
            :model-value="form.keys"
            :available-items="refs.keys"
            :with-date="false"
            @update:model-value="form.keys = $event"
          />
        </div>

        <!-- RECHTE SPALTE -->
        <div class="col">
          <div class="field">
            <label>E-Mail</label>
            <InputText v-model="form.email" type="email" class="w-full" />
            <small v-if="errors.email" class="p-error">{{ errors.email }}</small>
          </div>

          <div class="field">
            <label>URI</label>
            <InputText v-model="form.url" class="w-full" />
          </div>

          <div v-if="form.org_id === 'vbw'" class="field">
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

          <div class="field">
            <label>Weitere Mitgliedschaften</label>
            <Textarea v-model="form.mitgliedschaften" rows="2" class="w-full" />
          </div>

          <div class="field">
            <label>Verbandschargen</label>
            <Textarea v-model="form.verbandchargen" rows="2" class="w-full" />
          </div>

          <div class="field">
            <label>Anmerkungen</label>
            <Textarea v-model="form.anmerkungen" rows="3" class="w-full" />
          </div>

          <div class="field">
            <label>Arbeitgeber</label>
            <InputText v-model="form.arbeitgeber" class="w-full" />
          </div>

          <div class="field">
            <label>Tätigkeit</label>
            <InputText v-model="form.taetigkeit" class="w-full" />
          </div>

          <div class="field field--check">
            <label>
              <Checkbox v-model="form.chroniclemail" :binary="true" />
              Chroniclemails aktiviert
            </label>
          </div>
          <div class="field field--check">
            <label>
              <Checkbox v-model="form.auth_locked" :binary="true" />
              Zugang gesperrt
            </label>
          </div>
        </div>
      </div>

      <!-- Chargen: volle Breite -->
      <RolesHistoryEditor
        v-if="refs"
        :model-value="form.roles_history"
        :roles="refs.roles"
        @update:model-value="form.roles_history = $event"
      />

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
        <Button label="Abbrechen" icon="pi pi-times" text size="small" @click="router.back()" />
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
.member-edit {
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

/* --- Felder --- */
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

.field-pair {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
}

.field-pair > * {
  min-width: 0;
}

/* --- Sections --- */
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

.status-section {
  margin-top: 0.5rem;
  margin-bottom: 0.75rem;
  padding: 1rem;
  background: var(--p-surface-50);
  border-radius: 8px;
}

.dates-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.25rem;
}

.dates-grid > * {
  min-width: 0;
}

.w-full {
  width: 100%;
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
  .dates-grid {
    grid-template-columns: 1fr 1fr;
    gap: 0.25rem 1.25rem;
  }
}
</style>
