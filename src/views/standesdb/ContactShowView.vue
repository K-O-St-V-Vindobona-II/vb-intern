<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { formatApiError, formatDateTime } from '@/utils/formatters'
import standesdbService from '@/services/standesdbService'
import type { ContactDetail } from '@/types/standesdb'
import ImagePreview from '@/components/standesdb/ImagePreview.vue'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const confirm = useConfirm()
const toast = useToast()

const loading = ref(true)
const contact = ref<ContactDetail | null>(null)

const canEdit = () => authStore.user?.permissions?.includes('standesdbContactAdmin') ?? false

const isSystemAdmin = () => authStore.user?.permissions?.includes('systemAdmin') ?? false

const changelog = ref<
  {
    id: number
    modified_at: string | null
    modified_by_name: string | null
    action: string
    key: string
    old: string | null
    new: string | null
  }[]
>([])
const changelogLoaded = ref(false)
const changelogVisible = ref(false)

const toggleChangelog = () => {
  changelogVisible.value = !changelogVisible.value
  if (changelogVisible.value && !changelogLoaded.value) {
    loadChangelog()
  }
}

const loadChangelog = async () => {
  if (changelogLoaded.value || !contact.value) return
  try {
    const resp = await standesdbService.getChangelog('contact', contact.value.id)
    changelog.value = resp.data
  } catch {
    /* permission denied or error */
  }
  changelogLoaded.value = true
}

const actionSeverity = (action: string) => {
  if (action === 'store') return 'success'
  if (action === 'delete') return 'danger'
  return 'info'
}

const confirmDelete = () => {
  if (!contact.value) return
  confirm.require({
    message: `Kontakt "${contact.value.cn}" wirklich löschen?`,
    header: 'Kontakt löschen',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Abbrechen', severity: 'secondary' },
    acceptProps: { label: 'Löschen', severity: 'danger' },
    accept: async () => {
      try {
        await standesdbService.deleteContact(contact.value!.id)
        toast.add({ severity: 'success', summary: 'Kontakt gelöscht', life: 3000 })
        router.push({ name: 'standesdb-dashboard' })
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: formatApiError(e, 'Löschen fehlgeschlagen'),
          life: 5000,
        })
      }
    },
  })
}

const loadContact = async (id: number) => {
  loading.value = true
  contact.value = null
  try {
    const resp = await standesdbService.getContact(id)
    contact.value = resp.data
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404 || status === 403) {
      router.replace({ name: 'not-found' })
      return
    }
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.id,
  (id) => loadContact(Number(id)),
  { immediate: true },
)

const fuzzyDisplay = (date: string | null | undefined, accuracy: number) => {
  if (!date || accuracy === 0) return 'unbekannt'
  const [y = '', m = '', day = ''] = date.split('-')
  const months = [
    '',
    'Jänner',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ]
  switch (accuracy) {
    case 1:
      return y
    case 2:
      return `${months[parseInt(m)] ?? ''} ${y}`
    default:
      return `${parseInt(day)}. ${months[parseInt(m)] ?? ''} ${y}`
  }
}

const orgLabel = (orgId: string | null | undefined, label: string | null | undefined) =>
  label ?? (orgId ? orgId.toUpperCase() : '')
</script>

<template>
  <div class="contact-show">
    <template v-if="!loading && contact">
      <div class="page-header">
        <h2 class="page-title">Standesdatenbank</h2>
        <h3 class="page-subtitle">Kontakt</h3>
        <p class="page-name">
          {{ contact.cn }}
        </p>

        <ImagePreview
          :image-id="contact.default_image"
          owner-type="contact"
          :owner-id="contact.id"
          class="header-image"
        />

        <div class="header-actions">
          <Button
            label="Zur Suche"
            icon="pi pi-search"
            severity="info"
            size="small"
            @click="router.push({ name: 'standesdb-dashboard' })"
          />
          <Button
            label="Alle Profilbilder"
            icon="pi pi-images"
            severity="info"
            size="small"
            @click="router.push({ name: 'standesdb-contact-images', params: { id: contact!.id } })"
          />
          <Button
            v-if="canEdit()"
            label="Bearbeiten"
            icon="pi pi-pencil"
            severity="danger"
            size="small"
            @click="router.push({ name: 'standesdb-contact-edit', params: { id: contact!.id } })"
          />
          <Button
            v-if="canEdit()"
            label="Löschen"
            icon="pi pi-trash"
            severity="danger"
            size="small"
            outlined
            @click="confirmDelete"
          />
        </div>
      </div>

      <div class="two-col">
        <!-- LINKE SPALTE -->
        <div class="col">
          <div class="show-field">
            <label>Kontakttyp</label>
            <div class="show-value">
              {{ contact.kontakttyp === 'person' ? 'Person' : 'Organisation' }}
            </div>
          </div>

          <div class="show-field">
            <label>Anrede</label>
            <div class="show-value">
              {{ contact.anrede ?? '' }}
            </div>
          </div>

          <div class="show-field">
            <label>Name</label>
            <div class="show-value">
              {{ contact.name ?? '' }}
            </div>
          </div>

          <div class="show-field">
            <label>Couleurname</label>
            <div class="show-value">
              {{ contact.couleurname ?? '' }}
            </div>
          </div>

          <div class="show-field show-field--check">
            <span class="check-icon" :class="contact.zustellungen ? 'active' : ''">
              {{ contact.zustellungen ? '☑' : '☐' }}
            </span>
            <span>Zustellungen</span>
          </div>

          <label class="section-label">Adresse</label>
          <div class="show-field">
            <label>Adresse (Anschrift)</label>
            <div class="show-value">
              {{ contact.adresse_anschrift ?? '' }}
            </div>
          </div>
          <div class="show-field">
            <label>Adresse (PLZ)</label>
            <div class="show-value">
              {{ contact.adresse_plz ?? '' }}
            </div>
          </div>
          <div class="show-field">
            <label>Adresse (Ort)</label>
            <div class="show-value">
              {{ contact.adresse_ort ?? '' }}
            </div>
          </div>
          <div class="show-field">
            <label>Adresse (Land)</label>
            <div class="show-value">
              {{ contact.adresse_land ?? '' }}
            </div>
          </div>
        </div>

        <!-- RECHTE SPALTE -->
        <div class="col">
          <div class="show-field">
            <label>E-Mail</label>
            <div class="show-value">
              <a v-if="contact.email" :href="`mailto:${contact.email}`" class="value-link">{{
                contact.email
              }}</a>
            </div>
          </div>

          <div class="show-field">
            <label>Rufnummer</label>
            <div class="show-value">
              <a v-if="contact.rufnummer" :href="`tel:${contact.rufnummer}`" class="value-link">{{
                contact.rufnummer
              }}</a>
            </div>
          </div>

          <div class="show-field">
            <label>Datum</label>
            <div class="show-value">
              {{ fuzzyDisplay(contact.datum, contact.datum_accuracy) }}
            </div>
          </div>

          <div class="show-field">
            <label>Anmerkungen</label>
            <div class="show-value show-value--multi">
              {{ contact.anmerkungen ?? '' }}
            </div>
          </div>

          <div class="show-field">
            <label>Verbindung (Referenz)</label>
            <div class="show-value">
              {{ orgLabel(contact.org_id, contact.org_label) }}
            </div>
          </div>
        </div>
      </div>

      <div class="footer-actions">
        <Button
          label="Zur Suche"
          icon="pi pi-search"
          severity="info"
          size="small"
          @click="router.push({ name: 'standesdb-dashboard' })"
        />
        <Button
          label="Alle Profilbilder"
          icon="pi pi-images"
          severity="info"
          size="small"
          @click="router.push({ name: 'standesdb-contact-images', params: { id: contact!.id } })"
        />
        <Button
          v-if="canEdit()"
          label="Bearbeiten"
          icon="pi pi-pencil"
          severity="danger"
          size="small"
          @click="router.push({ name: 'standesdb-contact-edit', params: { id: contact!.id } })"
        />
        <Button
          v-if="canEdit()"
          label="Löschen"
          icon="pi pi-trash"
          severity="danger"
          size="small"
          outlined
          @click="confirmDelete"
        />
      </div>

      <div v-if="isSystemAdmin()" class="changelog-section">
        <div class="changelog-header" @click="toggleChangelog">
          <span class="changelog-title">Änderungshistorie</span>
          <i :class="['pi', changelogVisible ? 'pi-chevron-up' : 'pi-chevron-down']" />
        </div>
        <DataTable
          v-if="changelogVisible"
          :value="changelog"
          striped-rows
          size="small"
          scrollable
          :paginator="changelog.length > 25"
          :rows="25"
        >
          <Column field="modified_at" header="Datum" style="min-width: 9rem">
            <template #body="{ data }">
              {{ data.modified_at ? formatDateTime(data.modified_at) : '-' }}
            </template>
          </Column>
          <Column field="modified_by_name" header="Benutzer" style="min-width: 8rem" />
          <Column field="action" header="Aktion" style="min-width: 6rem">
            <template #body="{ data }">
              <Tag :value="data.action" :severity="actionSeverity(data.action)" />
            </template>
          </Column>
          <Column field="key" header="Feld" style="min-width: 7rem" />
          <Column field="old" header="Alt" style="min-width: 10rem">
            <template #body="{ data }">
              <span class="log-value">{{ data.old ?? '-' }}</span>
            </template>
          </Column>
          <Column field="new" header="Neu" style="min-width: 10rem">
            <template #body="{ data }">
              <span class="log-value">{{ data.new ?? '-' }}</span>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </div>
</template>

<style scoped>
.changelog-section {
  margin-top: 2rem;
}

.changelog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--p-surface-100);
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;
}

.changelog-header:hover {
  background: var(--p-surface-200);
}

.changelog-title {
  font-weight: 600;
  font-size: 0.95rem;
}

.changelog-header .pi {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.log-value {
  font-size: 0.8rem;
  word-break: break-all;
  max-width: 15rem;
  display: inline-block;
}

.contact-show {
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
  margin: 0.25rem 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.page-name {
  margin: 0 0 1rem;
  font-size: 0.95rem;
  color: var(--p-primary-color);
}

.header-image {
  margin: 0 auto 1rem;
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

.show-field {
  margin-bottom: 0.85rem;
}

.show-field label {
  display: block;
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.3rem;
}

.show-value {
  border: 1px solid var(--p-surface-200);
  border-radius: 6px;
  padding: 0.5rem 0.65rem;
  background: var(--p-surface-0);
  font-size: 0.9rem;
  min-height: 2.25rem;
  word-break: break-word;
}

.show-value--multi {
  white-space: pre-wrap;
  min-height: 3rem;
}

.value-link {
  color: var(--p-primary-color);
  text-decoration: none;
}

.value-link:hover {
  text-decoration: underline;
}

.show-field--check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  padding: 0.35rem 0;
}

.check-icon {
  font-size: 1.1rem;
  color: var(--p-surface-400);
}

.check-icon.active {
  color: var(--p-primary-color);
}

.section-label {
  display: block;
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--p-text-color);
  margin-bottom: 0.5rem;
  margin-top: 1.25rem;
}

@media (min-width: 768px) {
  .two-col {
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem 2rem;
  }
}
</style>
