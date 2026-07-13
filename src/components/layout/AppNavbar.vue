<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNavigation } from '@/composables/useNavigation'
import { useSessionManager } from '@/composables/useSessionManager'
import standesdbService from '@/services/standesdbService'
import Menubar from 'primevue/menubar'
import Drawer from 'primevue/drawer'

const router = useRouter()
const authStore = useAuthStore()
const { mainMenuItems } = useNavigation()
const { loginTime } = useSessionManager()

const profileDrawerVisible = ref(false)
const avatarUrl = ref<string | null>(null)
let avatarRequestId = 0

const userDisplayName = computed(() => {
  const u = authStore.user
  if (!u) return ''
  return u.cn || [u.vorname, u.nachname].filter(Boolean).join(' ') || u.email || ''
})

const loadAvatar = async () => {
  avatarUrl.value = null
  const u = authStore.user
  if (!u?.default_image) return

  const thisRequest = ++avatarRequestId
  try {
    const resp = await standesdbService.getImageUrl('member', u.id, u.default_image, true)
    if (thisRequest !== avatarRequestId) return
    avatarUrl.value = resp.data.url
  } catch {
    if (thisRequest !== avatarRequestId) return
    avatarUrl.value = null
  }
}

onMounted(loadAvatar)
watch(() => authStore.user?.default_image, loadAvatar)

const handleLogout = async () => {
  profileDrawerVisible.value = false
  await authStore.logout()
  router.push({ name: 'login' })
}

const goToProfile = () => {
  profileDrawerVisible.value = false
  router.push({ name: 'profile' })
}

const toggleUserMenu = () => {
  profileDrawerVisible.value = true
}
</script>

<template>
  <div class="navbar-wrapper">
    <Menubar :model="mainMenuItems" class="custom-menubar" :breakpoint="'768px'">
      <template #start>
        <div class="logo-container" @click="router.push({ name: 'home' })">
          <i class="pi pi-home logo-icon" />
          <span class="logo-text">VB intern</span>
        </div>
      </template>

      <template #end>
        <div v-if="authStore.user" class="user-actions">
          <button class="avatar-btn" @click="toggleUserMenu">
            <img v-if="avatarUrl" :src="avatarUrl" class="avatar-img-sm" alt="Profil" />
            <i v-else class="pi pi-user avatar-fallback" />
          </button>
        </div>
      </template>
    </Menubar>

    <Drawer
      v-model:visible="profileDrawerVisible"
      position="right"
      :header="userDisplayName"
      class="profile-drawer"
    >
      <div class="user-card">
        <div class="user-card-header">
          <img v-if="avatarUrl" :src="avatarUrl" class="avatar-img-lg" alt="Profil" />
          <div v-else class="avatar-placeholder-lg">
            <i class="pi pi-user" />
          </div>
          <div class="user-card-meta">
            <i class="pi pi-clock" />
            Angemeldet seit {{ loginTime }}
          </div>
          <div v-if="authStore.user" class="user-card-meta">
            Automatische Abmeldung nach {{ authStore.user?.session_idle_timeout ?? 30 }} Min.
            Inaktivität
          </div>
        </div>
        <div class="user-card-actions">
          <button class="user-card-action" @click="goToProfile">
            <i class="pi pi-user-edit" />
            Mein Benutzerkonto
          </button>
          <button class="user-card-action action-logout" @click="handleLogout">
            <i class="pi pi-sign-out" />
            Abmelden
          </button>
        </div>
      </div>
    </Drawer>
  </div>
</template>

<style scoped>
.navbar-wrapper {
  background-color: var(--p-primary-color);
  padding: 0;
  user-select: none;
  cursor: default;
}

.custom-menubar {
  border: none;
  border-radius: 0;
  padding: 0.25rem 0.75rem;
  background: transparent;
  max-width: 1400px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  .custom-menubar {
    padding: 0.5rem 1rem;
  }
}

:deep(.p-menubar-root-list > .p-menubar-item > .p-menubar-item-content > .p-menubar-item-link) {
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  font-size: 0.9rem;
}

:deep(
  .p-menubar-root-list
    > .p-menubar-item
    > .p-menubar-item-content
    > .p-menubar-item-link
    .p-menubar-item-icon
) {
  color: inherit;
}

:deep(.p-menubar-root-list > .p-menubar-item > .p-menubar-item-content) {
  border-radius: 6px;
  transition: background-color 0.15s;
}

:deep(.p-menubar-root-list > .p-menubar-item:hover > .p-menubar-item-content) {
  background-color: rgba(0, 0, 0, 0.15) !important;
}

:deep(.p-menubar-root-list > .p-menubar-item.p-menubar-item-active > .p-menubar-item-content) {
  background-color: rgba(0, 0, 0, 0.2) !important;
}

:deep(.p-menubar-root-list > .p-menubar-item.p-focus > .p-menubar-item-content) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.85) !important;
}

:deep(
  .p-menubar-root-list > .p-menubar-item.p-focus > .p-menubar-item-content .p-menubar-item-icon
),
:deep(
  .p-menubar-root-list > .p-menubar-item.p-focus > .p-menubar-item-content .p-menubar-submenu-icon
) {
  color: rgba(255, 255, 255, 0.85) !important;
}

:deep(
  .p-menubar-root-list > .p-menubar-item:hover > .p-menubar-item-content > .p-menubar-item-link
),
:deep(
  .p-menubar-root-list
    > .p-menubar-item.p-menubar-item-active
    > .p-menubar-item-content
    > .p-menubar-item-link
) {
  color: #fff;
}

:deep(.p-menubar-button) {
  color: rgba(255, 255, 255, 0.85);
}

.logo-container {
  display: flex;
  align-items: center;
  margin-right: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
}

.logo-icon {
  font-size: 1.1rem;
  color: #fff;
  margin-right: 0.4rem;
}

.logo-text {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

@media (min-width: 768px) {
  .logo-container {
    margin-right: 1.5rem;
  }

  .logo-icon {
    font-size: 1.2rem;
    margin-right: 0.5rem;
  }

  .logo-text {
    font-size: 1.15rem;
  }
}

.user-actions {
  display: flex;
  align-items: center;
}

/* --- Avatar Button in Navbar --- */
.avatar-btn {
  background: none;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 8px;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  overflow: hidden;
  transition: border-color 0.15s;
}

@media (min-width: 768px) {
  .avatar-btn {
    width: 38px;
    height: 38px;
  }
}

.avatar-btn:hover {
  border-color: #fff;
}

.avatar-img-sm {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.avatar-fallback {
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.85);
}

/* --- Profile Drawer --- */
.user-card {
  width: 100%;
  background: rgba(67, 180, 100, 0.07);
  border-radius: 8px;
}

.user-card-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 1rem 1.25rem;
  gap: 0.75rem;
}

.avatar-img-lg {
  max-width: 120px;
  max-height: 100px;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.avatar-placeholder-lg {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  background: var(--p-surface-100);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--p-text-muted-color);
}

.user-card-meta {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  text-align: center;
}

.user-card-meta .pi {
  margin-right: 0.25rem;
}

.user-card-actions {
  border-top: 1px solid var(--p-surface-200);
  padding: 0.5rem 0;
}

.user-card-action {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: var(--p-text-color);
  transition: background-color 0.1s;
}

.user-card-action:hover {
  background-color: var(--p-surface-100);
}

.action-logout {
  color: var(--p-red-500);
}

.action-logout:hover {
  background-color: var(--p-red-50);
}

/* --- Mobile menu --- */
:deep(.p-menubar-mobile .p-menubar-root-list) {
  background-color: var(--p-primary-color) !important;
  border-color: var(--p-primary-color) !important;
  padding: 0.5rem !important;
}

:deep(.p-menubar-mobile .p-menubar-root-list .p-menubar-item-content) {
  color: rgba(255, 255, 255, 0.85) !important;
  background: transparent !important;
}

:deep(.p-menubar-mobile .p-menubar-root-list .p-menubar-item-link) {
  color: rgba(255, 255, 255, 0.85) !important;
  font-size: 0.9rem;
}

:deep(.p-menubar-mobile .p-menubar-root-list .p-menubar-item-icon),
:deep(.p-menubar-mobile .p-menubar-root-list .p-menubar-submenu-icon) {
  color: rgba(255, 255, 255, 0.85) !important;
}

:deep(
  .p-menubar-mobile
    .p-menubar-root-list
    .p-menubar-item:not(.p-disabled)
    > .p-menubar-item-content:hover
) {
  background-color: rgba(0, 0, 0, 0.15) !important;
  color: #fff !important;
}

:deep(
  .p-menubar-mobile
    .p-menubar-root-list
    .p-menubar-item:not(.p-disabled)
    > .p-menubar-item-content:hover
    .p-menubar-item-link
),
:deep(
  .p-menubar-mobile
    .p-menubar-root-list
    .p-menubar-item:not(.p-disabled)
    > .p-menubar-item-content:hover
    .p-menubar-item-icon
),
:deep(
  .p-menubar-mobile
    .p-menubar-root-list
    .p-menubar-item:not(.p-disabled)
    > .p-menubar-item-content:hover
    .p-menubar-submenu-icon
) {
  color: #fff !important;
}

:deep(.p-menubar-mobile .p-menubar-root-list .p-menubar-item-active > .p-menubar-item-content) {
  background-color: rgba(0, 0, 0, 0.2) !important;
  color: #fff !important;
}

:deep(
  .p-menubar-mobile
    .p-menubar-root-list
    .p-menubar-item-active
    > .p-menubar-item-content
    .p-menubar-item-link
),
:deep(
  .p-menubar-mobile
    .p-menubar-root-list
    .p-menubar-item-active
    > .p-menubar-item-content
    .p-menubar-item-icon
),
:deep(
  .p-menubar-mobile
    .p-menubar-root-list
    .p-menubar-item-active
    > .p-menubar-item-content
    .p-menubar-submenu-icon
) {
  color: #fff !important;
}

:deep(.p-menubar-mobile .p-menubar-root-list .p-menubar-item.p-focus > .p-menubar-item-content) {
  background-color: rgba(0, 0, 0, 0.1) !important;
  color: #fff !important;
}

:deep(
  .p-menubar-mobile
    .p-menubar-root-list
    .p-menubar-item.p-focus
    > .p-menubar-item-content
    .p-menubar-item-icon
),
:deep(
  .p-menubar-mobile
    .p-menubar-root-list
    .p-menubar-item.p-focus
    > .p-menubar-item-content
    .p-menubar-submenu-icon
) {
  color: #fff !important;
}

:deep(.p-menubar-mobile .p-menubar-submenu) {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

:deep(.p-menubar-mobile .p-menubar-separator) {
  border-color: rgba(255, 255, 255, 0.2) !important;
}

:deep(.system-menu-item) > .p-menubar-item-content .p-menubar-item-label {
  color: #b91c1c !important;
  font-weight: 700;
}
</style>
