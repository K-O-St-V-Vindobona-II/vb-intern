<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import authService from '@/services/authService'
import { getApiErrorDetail } from '@/utils/formatters'
import { passwordMinLength } from '@/runtimeConfig'

import Card from 'primevue/card'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Message from 'primevue/message'

const route = useRoute()
const router = useRouter()

const email = ref('')
const token = ref('')
const password = ref('')
const passwordConfirm = ref('')

const isLoading = ref(false)
const isSuccess = ref(false)
const errorMessage = ref('')

onMounted(() => {
  email.value = (route.query['email'] as string) || ''
  token.value = (route.query['token'] as string) || ''

  if (!email.value || !token.value) {
    errorMessage.value =
      'Der Link ist ungültig oder unvollständig. Bitte fordere einen neuen Link an.'
  }
})

function validateResetForm(
  emailValue: string,
  tokenValue: string,
  passwordValue: string,
  passwordConfirmValue: string,
): string | null {
  if (!emailValue || !tokenValue) {
    return 'Ungültige Anfrage. Es fehlen Parameter.'
  }
  if (!passwordValue || !passwordConfirmValue) {
    return 'Bitte fülle beide Passwort-Felder aus.'
  }
  const minLength = passwordMinLength()
  if (passwordValue.length < minLength) {
    return `Das Passwort muss mindestens ${minLength} Zeichen lang sein.`
  }
  if (passwordValue !== passwordConfirmValue) {
    return 'Die Passwörter stimmen nicht überein.'
  }
  return null
}

const handleReset = async () => {
  const validationError = validateResetForm(
    email.value,
    token.value,
    password.value,
    passwordConfirm.value,
  )
  if (validationError) {
    errorMessage.value = validationError
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    await authService.executePasswordReset({
      email: email.value,
      token: token.value,
      password: password.value,
    })
    isSuccess.value = true
  } catch (error: unknown) {
    const detail = getApiErrorDetail(error)
    if (detail) {
      errorMessage.value = detail as string
    } else {
      errorMessage.value =
        'Ein unerwarteter Fehler ist aufgetreten. Bitte fordere einen neuen Link an.'
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
        <div class="reset-header">
          <div class="reset-icon-area">
            <i class="pi pi-key" />
          </div>
          <span>Neues Passwort vergeben</span>
        </div>
      </template>
      <template #content>
        <div v-if="isSuccess" class="text-center">
          <Message severity="success" :closable="false" class="auth-message">
            Dein Passwort wurde erfolgreich geändert! Du kannst dich nun mit dem neuen Passwort
            einloggen.
          </Message>
          <Button
            label="Zum Login"
            class="auth-full-width"
            @click="router.push({ name: 'login' })"
          />
        </div>

        <form v-else class="flex-column" @submit.prevent="handleReset">
          <p class="text-muted auth-hint">
            Bitte wähle ein neues Passwort für <br /><strong>{{ email }}</strong
            >.
          </p>

          <Message v-if="errorMessage" severity="error" :closable="false" class="auth-message">
            {{ errorMessage }}
          </Message>

          <div class="input-group">
            <label for="password">Neues Passwort</label>
            <Password
              id="password"
              v-model="password"
              toggle-mask
              prompt-label="Bitte Passwort eingeben"
              weak-label="Schwach"
              medium-label="Mittel"
              strong-label="Stark"
              placeholder="Dein neues Passwort"
            />
          </div>

          <div class="input-group">
            <label for="passwordConfirm">Passwort bestätigen</label>
            <Password
              id="passwordConfirm"
              v-model="passwordConfirm"
              toggle-mask
              :feedback="false"
              placeholder="Passwort wiederholen"
            />
          </div>

          <Button
            type="submit"
            label="Passwort speichern"
            :loading="isLoading"
            :disabled="!token || !email"
            class="auth-full-width auth-submit"
          />

          <Button
            label="Abbrechen & zum Login"
            text
            size="small"
            class="auth-link"
            @click="router.push({ name: 'login' })"
          />
        </form>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.reset-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.reset-icon-area {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: #fff;
  font-size: 1.6rem;
}

.auth-message {
  margin-bottom: 1rem;
}

.auth-hint {
  text-align: center;
  margin-bottom: 1rem;
  word-wrap: break-word;
}

.auth-full-width {
  width: 100%;
}

.auth-submit {
  margin-top: 1rem;
}

.auth-link {
  margin-top: 0.5rem;
}
</style>
