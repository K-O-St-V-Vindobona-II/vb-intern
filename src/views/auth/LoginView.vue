<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getApiErrorStatus, getApiErrorDetail } from '@/utils/formatters'
import type { GoogleCredentialResponse } from '@/types/auth'

import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Divider from 'primevue/divider'
import { GoogleLogin } from 'vue3-google-login'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

const needsLinking = ref(false)
const tempGoogleToken = ref('')

// Prevent Open Redirect via protocol-relative URLs
function isSafeRedirectPath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
}

const executeRedirect = () => {
  let redirectParam = router.currentRoute.value.query?.['redirect']

  if (!redirectParam) {
    const urlParams = new URLSearchParams(window.location.search)
    redirectParam = urlParams.get('redirect') || undefined
  }

  const path = Array.isArray(redirectParam) ? redirectParam[0] : redirectParam

  if (isSafeRedirectPath(path)) {
    router.push(path)
  } else {
    router.push({ name: 'home' })
  }
}

const handleLogin = async () => {
  if (!email.value || !password.value) {
    errorMessage.value = 'Bitte fülle alle Felder aus.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const formData = new URLSearchParams()
    formData.append('username', email.value)
    formData.append('password', password.value)

    await authStore.login(formData)
    executeRedirect()
  } catch (error: unknown) {
    if (getApiErrorStatus(error) === 401) {
      errorMessage.value = 'Ungültige E-Mail-Adresse oder Passwort.'
    } else {
      errorMessage.value = 'Ein unerwarteter Fehler ist aufgetreten.'
    }
  } finally {
    isLoading.value = false
  }
}

const handleGoogleCallback = async (response: GoogleCredentialResponse) => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    await authStore.googleLogin(response.credential)
    executeRedirect()
  } catch (error: unknown) {
    const status = getApiErrorStatus(error)
    if (status === 404 && getApiErrorDetail(error) === 'ACCOUNT_NOT_LINKED') {
      tempGoogleToken.value = response.credential
      needsLinking.value = true
    } else if (status === 401) {
      errorMessage.value = (getApiErrorDetail(error) as string) || 'Google Login fehlgeschlagen.'
    } else {
      errorMessage.value = 'Verbindung zum Backend fehlgeschlagen.'
    }
  } finally {
    isLoading.value = false
  }
}

const handleLinkAccount = async () => {
  if (!email.value || !password.value) {
    errorMessage.value = 'Bitte fülle beide Felder aus, um das Konto zu verknüpfen.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    await authStore.linkGoogle({
      credential: tempGoogleToken.value,
      email: email.value,
      password: password.value,
    })
    executeRedirect()
  } catch (error: unknown) {
    if (getApiErrorStatus(error) === 401) {
      errorMessage.value = (getApiErrorDetail(error) as string) || 'Falsche Zugangsdaten.'
    } else {
      errorMessage.value = 'Ein unerwarteter Fehler ist aufgetreten.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-wrapper">
    <Card class="auth-card">
      <template #title>
        <div class="login-header">
          <div class="login-icon-area">
            <i class="pi pi-shield" />
          </div>
          <span>Login VB intern</span>
        </div>
      </template>
      <template #content>
        <div v-if="needsLinking">
          <Message severity="info" :closable="false" class="auth-message">
            Dein Google-Konto ist noch mit keinem Profil verknüpft. Bitte logge dich einmalig mit
            deinen lokalen Zugangsdaten ein, um die Konten zu verbinden.
          </Message>

          <form class="flex-column" @submit.prevent="handleLinkAccount">
            <Message v-if="errorMessage" severity="error" :closable="false" class="auth-message">
              {{ errorMessage }}
            </Message>

            <div class="input-group">
              <label for="linkEmail">E-Mail</label>
              <InputText id="linkEmail" v-model="email" type="email" placeholder="E-Mail-Adresse" />
            </div>

            <div class="input-group">
              <label for="linkPassword">Passwort</label>
              <Password
                id="linkPassword"
                v-model="password"
                :feedback="false"
                toggle-mask
                fluid
                placeholder="Dein Passwort"
              />
            </div>

            <Button
              type="submit"
              label="Konto verknüpfen & Einloggen"
              :disabled="isLoading"
              :loading="isLoading"
              class="auth-submit"
            />
            <Button
              label="Abbrechen"
              text
              size="small"
              class="auth-link"
              @click="needsLinking = false"
            />
          </form>
        </div>

        <form v-else class="flex-column" @submit.prevent="handleLogin">
          <Message v-if="errorMessage" severity="error" :closable="false" class="auth-message">
            {{ errorMessage }}
          </Message>

          <div class="input-group">
            <label for="email">E-Mail</label>
            <InputText id="email" v-model="email" type="email" placeholder="E-Mail-Adresse" />
          </div>

          <div class="input-group">
            <label for="password">Passwort</label>
            <Password
              id="password"
              v-model="password"
              :feedback="false"
              toggle-mask
              fluid
              placeholder="Dein Passwort"
            />
          </div>

          <Button
            type="submit"
            label="Einloggen"
            :disabled="isLoading"
            :loading="isLoading"
            class="auth-submit"
          />

          <div class="auth-center">
            <Button
              label="Passwort vergessen?"
              link
              size="small"
              class="forgot-link"
              @click="router.push({ name: 'forgot-password' })"
            />
          </div>

          <Divider align="center">
            <span class="text-muted">ODER</span>
          </Divider>

          <div class="auth-center google-row">
            <GoogleLogin :callback="handleGoogleCallback" />
          </div>
        </form>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.login-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.login-icon-area {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--p-primary-400), var(--p-primary-600));
  color: #fff;
  font-size: 1.6rem;
}

.auth-message {
  margin-bottom: 1rem;
}

.auth-submit {
  width: 100%;
  margin-top: 1rem;
}

.auth-link {
  margin-top: 0.5rem;
}

.auth-center {
  text-align: center;
  margin-top: 0.5rem;
}

.forgot-link {
  padding: 0;
}

.google-row {
  display: flex;
  justify-content: center;
}
</style>
