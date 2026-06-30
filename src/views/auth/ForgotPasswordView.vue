<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import authService from '@/services/authService'

import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'

const router = useRouter()

const email = ref('')
const isLoading = ref(false)
const isSuccess = ref(false)
const errorMessage = ref('')

const handleRequestReset = async () => {
  if (!email.value) {
    errorMessage.value = 'Bitte gib deine E-Mail-Adresse ein.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    await authService.requestPasswordReset(email.value)
    isSuccess.value = true
  } catch {
    errorMessage.value = 'Ein unerwarteter Fehler ist aufgetreten.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-wrapper">
    <Card class="auth-card">
      <template #title>
        <div class="forgot-header">
          <div class="forgot-icon-area">
            <i class="pi pi-envelope" />
          </div>
          <span>Passwort vergessen</span>
        </div>
      </template>
      <template #content>
        <div v-if="isSuccess" class="text-center">
          <Message severity="success" :closable="false" class="auth-message">
            Falls diese E-Mail-Adresse in unserem System existiert, haben wir dir einen Link zum
            Zurücksetzen deines Passworts gesendet.
          </Message>
          <Button
            label="Zurück zum Login"
            text
            class="auth-full-width"
            @click="router.push({ name: 'login' })"
          />
        </div>

        <form v-else class="flex-column" @submit.prevent="handleRequestReset">
          <p class="text-muted auth-hint">
            Gib deine E-Mail-Adresse ein. Wir senden dir einen Link, mit dem du ein neues Passwort
            vergeben kannst.
          </p>

          <Message v-if="errorMessage" severity="error" :closable="false" class="auth-message">
            {{ errorMessage }}
          </Message>

          <div class="input-group">
            <label for="email">E-Mail</label>
            <InputText id="email" v-model="email" type="email" placeholder="E-Mail-Adresse" />
          </div>

          <Button
            type="submit"
            label="Link anfordern"
            :loading="isLoading"
            class="auth-full-width auth-submit"
          />

          <Button
            label="Zurück zum Login"
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
.forgot-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.forgot-icon-area {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: #fff;
  font-size: 1.6rem;
}

.auth-message {
  margin-bottom: 1rem;
}

.auth-hint {
  text-align: center;
  margin-bottom: 1rem;
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
