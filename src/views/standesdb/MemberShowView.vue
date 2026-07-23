<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePermission } from '@/composables/usePermission'
import standesdbService from '@/services/standesdbService'
import { formatDateTime, formatFullDate, fuzzyDisplay, getApiErrorStatus } from '@/utils/formatters'
import type { MemberDetail, MemberDismissed } from '@/types/standesdb'
import ImagePreview from '@/components/standesdb/ImagePreview.vue'
import FamilyTreeModal from '@/components/standesdb/FamilyTreeModal.vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'

const route = useRoute()
const router = useRouter()
const { hasPermission } = usePermission()

const loading = ref(true)
const treeDialogVisible = ref(false)
const member = ref<MemberDetail | null>(null)
const isDismissed = ref(false)
const dismissedData = ref<MemberDismissed | null>(null)

const canEdit = computed(() => {
  if (!member.value) return false
  const orgId = member.value.org_id ?? ''
  const orgPerm = `standesdb${orgId.charAt(0).toUpperCase() + orgId.slice(1)}Admin`
  return hasPermission(orgPerm)
})

const isSystemAdmin = computed(() => hasPermission('systemAdmin'))

const authActivity = ref<{
  auth_lastlogin: string | null
  auth_lastsignal: string | null
  auth_lastlogout: string | null
} | null>(null)

const loadAuthActivity = async (memberId: number) => {
  if (!isSystemAdmin.value) return
  try {
    const resp = await standesdbService.getMemberAuthActivity(memberId)
    authActivity.value = resp.data
  } catch {
    authActivity.value = null
  }
}

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
  if (changelogLoaded.value || !member.value) return
  try {
    const resp = await standesdbService.getChangelog('member', member.value.id)
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

const loadMember = async (id: number) => {
  loading.value = true
  member.value = null
  isDismissed.value = false
  dismissedData.value = null
  authActivity.value = null
  try {
    const resp = await standesdbService.getMember(id)
    const data = resp.data as unknown
    if (typeof data === 'object' && data !== null && 'dataprotection' in data) {
      isDismissed.value = true
      dismissedData.value = data as MemberDismissed
    } else {
      member.value = data as MemberDetail
      loadAuthActivity(id)
    }
  } catch (err: unknown) {
    const status = getApiErrorStatus(err)
    if (status === 404 || status === 403) {
      router.replace({ name: 'not-found' })
      return
    }
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params['id'],
  (id) => loadMember(Number(id)),
  { immediate: true },
)

const orgLabel = (orgId: string | null, label: string | null | undefined) =>
  label ?? (orgId ? orgId.toUpperCase() : '–')

const zustellungLabel = (val: string | null) => {
  const map: Record<string, string> = {
    adresse_privat: 'Privatadresse',
    adresse_beruf: 'Berufsadresse',
    deaktiviert: 'Deaktiviert',
  }
  return val ? (map[val] ?? val) : ''
}

const capitalize = (s: string | null | undefined) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
</script>

<template>
  <div class="member-show">
    <!-- DSGVO: entlassenes Mitglied -->
    <template v-if="isDismissed && dismissedData">
      <div class="dismissed-page">
        <div class="page-header">
          <h2 class="page-title">Standesdatenbank</h2>
          <h3 class="page-subtitle">Mitglied (entlassen)</h3>
          <p class="page-name">
            {{ dismissedData.cn }}
          </p>
        </div>
        <Message severity="warn" :closable="false" class="dismissed-message">
          Entlassene Personen werden aus Datenschutzgründen nicht angezeigt.
        </Message>
        <div class="show-field dismissed-field">
          <label>Organisation</label>
          <div class="show-value">
            {{ dismissedData.org_id?.toUpperCase() ?? '–' }}
          </div>
        </div>
        <div class="dismissed-actions">
          <Button
            label="Zur Suche"
            icon="pi pi-search"
            severity="info"
            size="small"
            @click="router.push({ name: 'standesdb-dashboard' })"
          />
        </div>
      </div>
    </template>

    <!-- Vollständige Anzeige -->
    <template v-if="!loading && member">
      <div class="page-header">
        <h2 class="page-title">Standesdatenbank</h2>
        <h3 class="page-subtitle">Mitglied</h3>
        <p class="page-name">
          {{ member.cn }}
        </p>

        <ImagePreview
          :image-id="member.default_image"
          owner-type="member"
          :owner-id="member.id"
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
            @click="router.push({ name: 'standesdb-member-images', params: { id: member!.id } })"
          />
          <Button
            v-if="canEdit"
            label="Bearbeiten"
            icon="pi pi-pencil"
            severity="danger"
            size="small"
            @click="router.push({ name: 'standesdb-member-edit', params: { id: member!.id } })"
          />
        </div>
      </div>

      <!-- Zwei-Spalten-Layout wie Legacy-App -->
      <div class="two-col">
        <!-- LINKE SPALTE -->
        <div class="col">
          <div class="show-field">
            <label>Verbindung</label>
            <div class="show-value">
              {{ orgLabel(member.org_id, member.org_label) }}
            </div>
          </div>

          <div class="show-field show-field--check">
            <span class="check-icon" :class="member.gruender ? 'active' : ''">
              {{ member.gruender ? '☑' : '☐' }}
            </span>
            <span>Gründer</span>
          </div>

          <div class="show-field-pair">
            <div class="show-field">
              <label>Vortitel</label>
              <div class="show-value">
                {{ member.vortitel ?? '' }}
              </div>
            </div>
            <div class="show-field">
              <label>Vorname</label>
              <div class="show-value">
                {{ member.vorname ?? '' }}
              </div>
            </div>
          </div>

          <div class="show-field-pair">
            <div class="show-field">
              <label>Nachname</label>
              <div class="show-value">
                {{ member.nachname ?? '' }}
              </div>
            </div>
            <div class="show-field">
              <label>Nachtitel</label>
              <div class="show-value">
                {{ member.nachtitel ?? '' }}
              </div>
            </div>
          </div>

          <div class="show-field-pair">
            <div class="show-field">
              <label>Couleurname</label>
              <div class="show-value">
                {{ member.couleurname ?? '' }}
              </div>
            </div>
            <div class="show-field">
              <label>Geburtsname</label>
              <div class="show-value">
                {{ member.nachname_geburt ?? '' }}
              </div>
            </div>
          </div>

          <div class="show-field">
            <label>Mitgliedstatus</label>
            <div class="show-value">
              {{ member.state_label ?? member.state_id ?? '–' }}
            </div>
          </div>

          <div class="show-field show-field--check">
            <span class="check-icon" :class="member.entlassen ? 'active' : ''">
              {{ member.entlassen ? '☑' : '☐' }}
            </span>
            <span>entlassen</span>
          </div>

          <div class="show-field show-field--check">
            <span class="check-icon" :class="member.verstorben ? 'active' : ''">
              {{ member.verstorben ? '☑' : '☐' }}
            </span>
            <span>verstorben</span>
          </div>

          <div class="show-field">
            <label>Leibbursch</label>
            <div class="leibbursch-row">
              <div class="show-value leibbursch-value">
                <router-link
                  v-if="member.parent_id"
                  :to="{ name: 'standesdb-member-show', params: { id: member.parent_id } }"
                  class="value-link"
                >
                  {{ member.parent_cn }}
                </router-link>
                <span v-else>–</span>
              </div>
              <Button
                icon="pi pi-sitemap"
                severity="secondary"
                text
                rounded
                class="tree-button"
                @click="treeDialogVisible = true"
              />
            </div>
          </div>

          <div class="show-field">
            <label>Geburtsdatum</label>
            <div class="show-value">
              {{ fuzzyDisplay(member.geburtsdatum, member.geburtsdatum_accuracy) }}
            </div>
          </div>

          <div class="show-field">
            <label>Aufnahmedatum</label>
            <div class="show-value">
              {{ fuzzyDisplay(member.aufnahmedatum, member.aufnahmedatum_accuracy) }}
            </div>
          </div>

          <div class="show-field">
            <label>Branderdatum</label>
            <div class="show-value">
              {{ fuzzyDisplay(member.branderdatum, member.branderdatum_accuracy) }}
            </div>
          </div>

          <div class="show-field">
            <label>Burschungsdatum</label>
            <div class="show-value">
              {{ fuzzyDisplay(member.burschungsdatum, member.burschungsdatum_accuracy) }}
            </div>
          </div>

          <div class="show-field">
            <label>Philistrierungsdatum</label>
            <div class="show-value">
              {{ fuzzyDisplay(member.philistrierungsdatum, member.philistrierungsdatum_accuracy) }}
            </div>
          </div>

          <!-- Ehrungen -->
          <div v-if="member.badges.length" class="show-section">
            <label class="section-label">Ehrungen</label>
            <DataTable :value="member.badges" striped-rows size="small" class="compact-table">
              <Column header="Gruppe">
                <template #body="{ data }">
                  {{ capitalize(data.group) }}
                </template>
              </Column>
              <Column header="Name">
                <template #body="{ data }">
                  {{ data.name ?? '' }}
                </template>
              </Column>
              <Column header="Datum">
                <template #body="{ data }">
                  {{ fuzzyDisplay(data.presentationdate, data.presentationdate_accuracy) }}
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Schlüssel -->
          <div v-if="member.keys.length" class="show-section">
            <label class="section-label">Schlüssel</label>
            <DataTable :value="member.keys" striped-rows size="small" class="compact-table">
              <Column header="Name">
                <template #body="{ data }">
                  {{ capitalize(data.name) }}
                </template>
              </Column>
            </DataTable>
          </div>
        </div>

        <!-- RECHTE SPALTE -->
        <div class="col">
          <div class="show-field">
            <label>E-Mail</label>
            <div class="show-value">
              <a v-if="member.email" :href="`mailto:${member.email}`" class="value-link">{{
                member.email
              }}</a>
            </div>
          </div>

          <div v-if="member.email_verified_at" class="show-field show-field--small">
            <span class="muted-text">
              Email verifiziert:
              {{ formatFullDate(member.email_verified_at?.split('T')[0] ?? null) }}
            </span>
          </div>

          <div class="show-field">
            <label>URI</label>
            <div class="show-value">
              <a
                v-if="member.url"
                :href="member.url"
                target="_blank"
                rel="noopener"
                class="value-link"
                >{{ member.url }}</a
              >
            </div>
          </div>

          <div class="show-field">
            <label>MKV/OGV-Link</label>
            <div class="show-value">
              <a
                v-if="member.mkv_ogv_url"
                :href="member.mkv_ogv_url"
                target="_blank"
                rel="noopener"
                class="value-link"
                >{{ member.mkv_ogv_url }}</a
              >
            </div>
          </div>

          <div class="show-field">
            <label>Rufnummer (mobil)</label>
            <div class="show-value">
              <a
                v-if="member.rufnummer_mobil"
                :href="`tel:${member.rufnummer_mobil}`"
                class="value-link"
                >{{ member.rufnummer_mobil }}</a
              >
            </div>
          </div>

          <div class="show-field">
            <label>Rufnummer (privat)</label>
            <div class="show-value">
              <a
                v-if="member.rufnummer_privat"
                :href="`tel:${member.rufnummer_privat}`"
                class="value-link"
                >{{ member.rufnummer_privat }}</a
              >
            </div>
          </div>

          <div class="show-field">
            <label>Rufnummer (beruflich)</label>
            <div class="show-value">
              <a
                v-if="member.rufnummer_beruf"
                :href="`tel:${member.rufnummer_beruf}`"
                class="value-link"
                >{{ member.rufnummer_beruf }}</a
              >
            </div>
          </div>

          <div class="show-field">
            <label>Zustellungen</label>
            <div class="show-value">
              {{ zustellungLabel(member.zustellungen) }}
            </div>
          </div>

          <label class="section-label">Privatadresse</label>
          <div class="show-field">
            <label>Privatadresse (Anschrift)</label>
            <div class="show-value">
              {{ member.adresse_privat_anschrift ?? '' }}
            </div>
          </div>
          <div class="show-field">
            <label>Privatadresse (PLZ)</label>
            <div class="show-value">
              {{ member.adresse_privat_plz ?? '' }}
            </div>
          </div>
          <div class="show-field">
            <label>Privatadresse (Ort)</label>
            <div class="show-value">
              {{ member.adresse_privat_ort ?? '' }}
            </div>
          </div>
          <div class="show-field">
            <label>Privatadresse (Land)</label>
            <div class="show-value">
              {{ member.adresse_privat_land ?? '' }}
            </div>
          </div>

          <label class="section-label">Berufsadresse</label>
          <div class="show-field">
            <label>Berufsadresse (Anschrift)</label>
            <div class="show-value">
              {{ member.adresse_beruf_anschrift ?? '' }}
            </div>
          </div>
          <div class="show-field">
            <label>Berufsadresse (PLZ)</label>
            <div class="show-value">
              {{ member.adresse_beruf_plz ?? '' }}
            </div>
          </div>
          <div class="show-field">
            <label>Berufsadresse (Ort)</label>
            <div class="show-value">
              {{ member.adresse_beruf_ort ?? '' }}
            </div>
          </div>
          <div class="show-field">
            <label>Berufsadresse (Land)</label>
            <div class="show-value">
              {{ member.adresse_beruf_land ?? '' }}
            </div>
          </div>

          <div class="show-field">
            <label>Weitere Mitgliedschaften</label>
            <div class="show-value show-value--multi">
              {{ member.mitgliedschaften ?? '' }}
            </div>
          </div>

          <div class="show-field">
            <label>Verbandschargen</label>
            <div class="show-value show-value--multi">
              {{ member.verbandchargen ?? '' }}
            </div>
          </div>

          <div class="show-field">
            <label>Anmerkungen</label>
            <div class="show-value show-value--multi">
              {{ member.anmerkungen ?? '' }}
            </div>
          </div>

          <div class="show-field">
            <label>Arbeitgeber</label>
            <div class="show-value">
              {{ member.arbeitgeber ?? '' }}
            </div>
          </div>

          <div class="show-field">
            <label>Tätigkeit</label>
            <div class="show-value">
              {{ member.taetigkeit ?? '' }}
            </div>
          </div>

          <div class="show-field show-field--check">
            <span class="check-icon" :class="member.chroniclemail ? 'active' : ''">
              {{ member.chroniclemail ? '☑' : '☐' }}
            </span>
            <span>Chroniclemails aktiviert</span>
          </div>

          <div class="show-field show-field--check">
            <span class="check-icon" :class="member.auth_locked ? 'active' : ''">
              {{ member.auth_locked ? '☑' : '☐' }}
            </span>
            <span>Zugang gesperrt</span>
          </div>
        </div>
      </div>

      <!-- Chargen-Tabelle: volle Breite -->
      <div v-if="member.roles_history.length" class="show-section full-width-section">
        <label class="section-label">Chargen, Funktionen, Kommissionen</label>
        <DataTable
          :value="
            [...member.roles_history].sort((a, b) =>
              (a.startdate ?? '').localeCompare(b.startdate ?? ''),
            )
          "
          striped-rows
          size="small"
          scrollable
          class="compact-table"
        >
          <Column header="von">
            <template #body="{ data }">
              {{ formatFullDate(data.startdate) }}
            </template>
          </Column>
          <Column header="bis">
            <template #body="{ data }">
              <span v-if="data.enddate">{{ formatFullDate(data.enddate) }}</span>
              <span v-else class="ongoing-badge">laufend</span>
            </template>
          </Column>
          <Column header="Gruppe">
            <template #body="{ data }">
              {{ capitalize(data.group) }}
            </template>
          </Column>
          <Column field="label" header="Rolle" />
        </DataTable>
      </div>

      <!-- Footer-Aktionen -->
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
          @click="router.push({ name: 'standesdb-member-images', params: { id: member!.id } })"
        />
        <Button
          v-if="canEdit"
          label="Bearbeiten"
          icon="pi pi-pencil"
          severity="danger"
          size="small"
          @click="router.push({ name: 'standesdb-member-edit', params: { id: member!.id } })"
        />
      </div>

      <!-- Stammbaum Modal -->
      <FamilyTreeModal
        v-model:visible="treeDialogVisible"
        :ancestry="member.tree?.ancestry ?? []"
        :children="member.tree?.children ?? []"
        :member-id="member.id"
      />

      <div v-if="isSystemAdmin && authActivity" class="auth-activity-section">
        <label class="section-label">Letzte Aktivität</label>
        <div class="auth-activity-grid">
          <div class="auth-activity-item">
            <i class="pi pi-sign-in" />
            <span class="auth-activity-label">Letzter Login</span>
            <span class="auth-activity-value">{{
              authActivity.auth_lastlogin ? formatDateTime(authActivity.auth_lastlogin) : '–'
            }}</span>
          </div>
          <div class="auth-activity-item">
            <i class="pi pi-wave-pulse" />
            <span class="auth-activity-label">Letztes Signal</span>
            <span class="auth-activity-value">{{
              authActivity.auth_lastsignal ? formatDateTime(authActivity.auth_lastsignal) : '–'
            }}</span>
          </div>
          <div class="auth-activity-item">
            <i class="pi pi-sign-out" />
            <span class="auth-activity-label">Letzter Logout</span>
            <span class="auth-activity-value">{{
              authActivity.auth_lastlogout ? formatDateTime(authActivity.auth_lastlogout) : '–'
            }}</span>
          </div>
        </div>
      </div>

      <div v-if="isSystemAdmin" class="changelog-section">
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
.auth-activity-section {
  margin-top: 2rem;
}

.auth-activity-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
}

.auth-activity-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--p-surface-50);
  border: 1px solid var(--p-surface-200);
  border-radius: 6px;
  font-size: 0.85rem;
}

.auth-activity-item .pi {
  color: var(--p-primary-color);
  font-size: 0.9rem;
}

.auth-activity-label {
  color: var(--p-text-muted-color);
  min-width: 6rem;
}

.auth-activity-value {
  font-weight: 600;
}

@media (min-width: 768px) {
  .auth-activity-grid {
    grid-template-columns: 1fr 1fr 1fr;
  }

  .auth-activity-item {
    flex-direction: column;
    text-align: center;
    padding: 0.75rem;
  }

  .auth-activity-label {
    min-width: unset;
  }
}

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

.member-show {
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

/* --- Zwei-Spalten-Layout --- */
.two-col {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  margin-top: 1.5rem;
}

.col {
  min-width: 0;
}

.show-field-pair {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
}

.show-field-pair > * {
  min-width: 0;
}

/* --- Felder: Label + Bordered Value Box --- */
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

/* --- Checkboxen (read-only) --- */
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

.show-field--small {
  margin-bottom: 0.75rem;
}

.muted-text {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
  font-style: italic;
}

/* --- Sections (Tabellen) --- */
.show-section {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.section-label {
  display: block;
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--p-text-color);
  margin-bottom: 0.5rem;
  margin-top: 1.25rem;
}

.compact-table {
  font-size: 0.85rem;
}

.full-width-section {
  margin-top: 1.5rem;
}

.ongoing-badge {
  color: var(--p-green-500);
  font-weight: 600;
}

/* --- Dismissed page --- */
.dismissed-page {
  max-width: 500px;
  margin: 0 auto;
  text-align: center;
}

.dismissed-message {
  margin: 2rem 0;
}

.dismissed-field {
  margin: 2rem auto;
  max-width: 300px;
  text-align: left;
}

.dismissed-actions {
  margin-top: 2.5rem;
}

/* --- Leibbursch + Stammbaum Button --- */
.leibbursch-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.leibbursch-value {
  flex: 1;
}

.tree-button {
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .two-col {
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem 2rem;
  }
  .show-field-pair {
    grid-template-columns: 1fr 1fr;
    gap: 0 1.25rem;
  }
}
</style>
