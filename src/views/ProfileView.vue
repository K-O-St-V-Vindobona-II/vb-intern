<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import memberService from '@/services/memberService'
import { appEnvironment } from '@/runtimeConfig'

import Card from 'primevue/card'
import Button from 'primevue/button'

const authStore = useAuthStore()
const confirm = useConfirm()
const toast = useToast()

const unlinkLoading = ref(false)
const chronicleLoading = ref(false)

const executeUnlink = async () => {
  unlinkLoading.value = true
  try {
    await authStore.unlinkGoogle()
    toast.add({ severity: 'success', summary: 'Google-Verknüpfung wurde entfernt.', life: 3000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Fehler beim Lösen der Verknüpfung.', life: 4000 })
  } finally {
    unlinkLoading.value = false
  }
}

const handleUnlink = () => {
  confirm.require({
    message:
      'Möchtest du die Verknüpfung zu deinem Google-Konto wirklich lösen? Du musst dich danach wieder mit Passwort einloggen.',
    header: 'Verknüpfung lösen',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Abbrechen', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Ja, Verknüpfung lösen', severity: 'danger' },
    accept: () => executeUnlink(),
  })
}

const toggleChronicle = async () => {
  chronicleLoading.value = true
  try {
    const newVal = await memberService.toggleChronicleMail()
    if (authStore.user) {
      authStore.user.chroniclemail = newVal
    }
    toast.add({
      severity: 'success',
      summary: newVal ? 'Chronik-Emails aktiviert.' : 'Chronik-Emails deaktiviert.',
      life: 3000,
    })
  } catch {
    toast.add({ severity: 'error', summary: 'Fehler beim Umschalten.', life: 4000 })
  } finally {
    chronicleLoading.value = false
  }
}
</script>

<template>
  <div v-if="authStore.user" class="profile-wrapper">
    <h1 class="page-title">Mein Profil</h1>

    <!-- Stammdaten -->
    <Card class="profile-card">
      <template #title>
        <i class="pi pi-user card-icon" />
        Stammdaten
      </template>
      <template #content>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Vorname</span>
            <span class="info-value">{{ authStore.user.vorname }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Nachname</span>
            <span class="info-value">{{ authStore.user.nachname }}</span>
          </div>
          <div v-if="authStore.user.couleurname" class="info-item">
            <span class="info-label">Couleurname</span>
            <span class="info-value">{{ authStore.user.couleurname }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">E-Mail</span>
            <span class="info-value">{{ authStore.user.email }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Organisation</span>
            <span class="info-value">{{ authStore.user.org_id.toUpperCase() }}</span>
          </div>
        </div>
      </template>
    </Card>

    <!-- Chronik-Emails -->
    <Card class="profile-card">
      <template #title>
        <i class="pi pi-envelope card-icon" />
        Chronik-Emails
      </template>
      <template #content>
        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-status">
              Status:
              <span v-if="authStore.user.chroniclemail" class="status-active">aktiviert</span>
              <span v-else class="status-inactive">deaktiviert</span>
            </span>
            <span class="toggle-hint">
              Wöchentliche E-Mails mit Geburtstagen, Jubiläen und Neuigkeiten.
            </span>
          </div>
          <Button
            :label="authStore.user.chroniclemail ? 'Deaktivieren' : 'Aktivieren'"
            :severity="authStore.user.chroniclemail ? 'secondary' : 'success'"
            :loading="chronicleLoading"
            size="small"
            outlined
            @click="toggleChronicle"
          />
        </div>
      </template>
    </Card>

    <!-- Google Login -->
    <Card class="profile-card">
      <template #title>
        <i class="pi pi-google card-icon" />
        Google Login
      </template>
      <template #content>
        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-status">
              Status:
              <span v-if="authStore.user.google_linked" class="status-active">verbunden</span>
              <span v-else class="status-inactive">nicht verbunden</span>
            </span>
            <span v-if="!authStore.user.google_linked" class="toggle-hint">
              Du kannst dein Google-Konto beim nächsten Login verknüpfen.
            </span>
          </div>
          <Button
            v-if="authStore.user.google_linked"
            label="Verknüpfung lösen"
            icon="pi pi-link-slash"
            severity="danger"
            outlined
            size="small"
            :loading="unlinkLoading"
            @click="handleUnlink"
          />
        </div>
      </template>
    </Card>

    <!-- Berechtigungen -->
    <Card class="profile-card">
      <template #title>
        <i class="pi pi-shield card-icon" />
        Berechtigungen
      </template>
      <template #content>
        <div v-if="authStore.user.permissions.length" class="permissions-grid">
          <div v-for="perm in authStore.user.permissions" :key="perm" class="permission-badge">
            <i class="pi pi-check-circle" />
            {{ perm }}
          </div>
        </div>
        <p v-else class="empty-hint">Keine speziellen Berechtigungen zugewiesen.</p>
      </template>
    </Card>

    <p v-if="appEnvironment()" class="env-footer">{{ appEnvironment() }}</p>
  </div>
</template>

<style scoped>
.profile-wrapper {
  max-width: 700px;
  margin: 0 auto;
}

.page-title {
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

.profile-card {
  margin-bottom: 1.25rem;
}

.profile-card :deep(.p-card-title) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
}

.card-icon {
  color: var(--p-primary-color);
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.info-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.info-value {
  font-size: 1rem;
}

.toggle-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--p-surface-50);
  border-radius: var(--p-border-radius);
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.toggle-status {
  font-weight: 500;
}

.status-active {
  color: var(--p-green-500);
  font-weight: 600;
}

.status-inactive {
  color: var(--p-text-muted-color);
}

.toggle-hint {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.permissions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.permission-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.75rem;
  background: var(--p-surface-100);
  border-radius: 2rem;
  font-size: 0.85rem;
  font-weight: 500;
}

.permission-badge .pi {
  color: var(--p-green-500);
  font-size: 0.85rem;
}

.empty-hint {
  color: var(--p-text-muted-color);
  font-style: italic;
  margin: 0;
}

.env-footer {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  opacity: 0.6;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

@media (min-width: 600px) {
  .info-grid {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem 2rem;
  }

  .toggle-row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
}
</style>
