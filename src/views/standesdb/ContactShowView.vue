<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePermission } from '@/composables/usePermission'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { formatApiError, formatDateTime, fuzzyDisplay, getApiErrorStatus } from '@/utils/formatters'
import standesdbService from '@/services/standesdbService'
import type { ContactDetail } from '@/types/standesdb'
import ImagePreview from '@/components/standesdb/ImagePreview.vue'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Message from 'primevue/message'
import Tag from 'primevue/tag'

const route = useRoute()
const router = useRouter()
const { hasPermission } = usePermission()
const confirm = useConfirm()
const toast = useToast()

const loading = ref(true)
const loadFailed = ref(false)
const contact = ref<ContactDetail | null>(null)
let loadContactId = 0

const canEdit = computed(() => hasPermission('standesdbContactAdmin'))

const changelog = ref<
  {
    id: string
    modified_at: string | null
    modified_by_name: string | null
    action: string
    key: string
    old: string | null
    new: string | null
  }[]
>([])
const changelogTotal = ref(0)
const changelogRows = 25
const changelogLoading = ref(false)
const changelogLoaded = ref(false)
const changelogFailed = ref(false)
const changelogVisible = ref(false)
let changelogRequestId = 0

// The history belongs to the contact it was loaded for: forget it whenever
// another contact is loaded into this page.
const resetChangelog = () => {
  changelogRequestId++
  changelog.value = []
  changelogTotal.value = 0
  changelogLoading.value = false
  changelogLoaded.value = false
  changelogFailed.value = false
  changelogVisible.value = false
}

const loadChangelog = async (page: number) => {
  const target = contact.value
  if (!target) return
  const thisRequest = ++changelogRequestId
  changelogLoading.value = true
  changelogFailed.value = false
  try {
    const resp = await standesdbService.getChangelog('contact', target.id, {
      page,
      page_size: changelogRows,
    })
    if (thisRequest !== changelogRequestId) return
    changelog.value = resp.data.items
    changelogTotal.value = resp.data.total
    changelogLoaded.value = true
  } catch {
    if (thisRequest !== changelogRequestId) return
    changelogFailed.value = true
  } finally {
    if (thisRequest === changelogRequestId) changelogLoading.value = false
  }
}

const toggleChangelog = () => {
  changelogVisible.value = !changelogVisible.value
  if (changelogVisible.value && !changelogLoaded.value) {
    loadChangelog(1)
  }
}

const onChangelogPage = (event: { page: number }) => {
  loadChangelog(event.page + 1)
}

const actionSeverity = (action: string) => {
  if (action === 'store') return 'success'
  if (action === 'delete') return 'danger'
  return 'info'
}

const deleteContact = async (target: ContactDetail) => {
  try {
    await standesdbService.deleteContact(target.id)
    toast.add({ severity: 'success', summary: 'Kontakt gelöscht', life: 3000 })
    router.push({ name: 'standesdb-dashboard' })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: formatApiError(e, 'Löschen fehlgeschlagen'),
      life: 5000,
    })
  }
}

// The contact is captured when the dialog opens: the dialog outlives a change of
// the address, and the confirmed delete must hit the contact the dialog names.
const confirmDelete = () => {
  const target = contact.value
  if (!target) return
  confirm.require({
    message: `Kontakt "${target.cn}" wirklich löschen?`,
    header: 'Kontakt löschen',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Abbrechen', severity: 'secondary' },
    acceptProps: { label: 'Löschen', severity: 'danger' },
    accept: () => deleteContact(target),
  })
}

const openContactPage = (name: 'standesdb-contact-images' | 'standesdb-contact-edit') => {
  if (!contact.value) return
  router.push({ name, params: { id: contact.value.id } })
}

const loadContact = async (id: string) => {
  const thisRequest = ++loadContactId
  loading.value = true
  loadFailed.value = false
  contact.value = null
  resetChangelog()
  try {
    const resp = await standesdbService.getContact(id)
    if (thisRequest !== loadContactId) return
    contact.value = resp.data
  } catch (err: unknown) {
    if (thisRequest !== loadContactId) return
    const status = getApiErrorStatus(err)
    if (status === 404 || status === 403) {
      router.replace({ name: 'not-found' })
      return
    }
    loadFailed.value = true
  } finally {
    if (thisRequest === loadContactId) loading.value = false
  }
}

watch(
  () => route.params['id'],
  (id) => loadContact(String(id)),
  { immediate: true },
)

const orgLabel = (orgId: string | null | undefined, label: string | null | undefined) =>
  label ?? (orgId ? orgId.toUpperCase() : '')
</script>

<template>
  <div class="contact-show">
    <div v-if="loadFailed" class="load-error">
      <Message severity="error" :closable="false">Der Kontakt konnte nicht geladen werden.</Message>
      <Button
        label="Erneut versuchen"
        icon="pi pi-refresh"
        size="small"
        @click="loadContact(String(route.params['id']))"
      />
    </div>

    <template v-else-if="!loading && contact">
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
            @click="openContactPage('standesdb-contact-images')"
          />
          <Button
            v-if="canEdit"
            label="Bearbeiten"
            icon="pi pi-pencil"
            severity="danger"
            size="small"
            @click="openContactPage('standesdb-contact-edit')"
          />
          <Button
            v-if="canEdit"
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
        <!-- left column -->
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

        <!-- right column -->
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
          @click="openContactPage('standesdb-contact-images')"
        />
        <Button
          v-if="canEdit"
          label="Bearbeiten"
          icon="pi pi-pencil"
          severity="danger"
          size="small"
          @click="openContactPage('standesdb-contact-edit')"
        />
        <Button
          v-if="canEdit"
          label="Löschen"
          icon="pi pi-trash"
          severity="danger"
          size="small"
          outlined
          @click="confirmDelete"
        />
      </div>

      <div v-if="canEdit" class="changelog-section">
        <button
          type="button"
          class="changelog-header"
          :aria-expanded="changelogVisible"
          aria-controls="contact-changelog"
          @click="toggleChangelog"
        >
          <span class="changelog-title">Änderungshistorie</span>
          <i :class="['pi', changelogVisible ? 'pi-chevron-up' : 'pi-chevron-down']" />
        </button>
        <div v-if="changelogVisible && changelogFailed" class="changelog-error">
          <Message severity="error" :closable="false">
            Die Änderungshistorie konnte nicht geladen werden.
          </Message>
          <Button
            label="Erneut versuchen"
            icon="pi pi-refresh"
            size="small"
            @click="loadChangelog(1)"
          />
        </div>
        <DataTable
          v-else-if="changelogVisible"
          id="contact-changelog"
          :value="changelog"
          striped-rows
          size="small"
          scrollable
          lazy
          :loading="changelogLoading"
          :paginator="changelogTotal > changelogRows"
          :rows="changelogRows"
          :total-records="changelogTotal"
          @page="onChangelogPage"
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

.load-error,
.changelog-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.changelog-error {
  margin-top: 1rem;
}

.changelog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--app-surface-subtle);
  border: 1px solid var(--app-border-card);
  border-radius: 8px;
  color: inherit;
  font: inherit;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;
}

.changelog-header:hover {
  background: var(--app-border-card);
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
  border: 1px solid var(--app-border-card);
  border-radius: 6px;
  padding: 0.5rem 0.65rem;
  background: var(--app-surface-card);
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
  color: var(--p-text-muted-color);
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
