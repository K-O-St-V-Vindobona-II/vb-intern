<script setup lang="ts">
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'

const router = useRouter()
</script>

<template>
  <div class="error-wrapper">
    <Card class="error-card">
      <template #title>
        <div class="title-container">
          <div class="error-icon-area">
            <i class="pi pi-lock" />
          </div>
          <h1 class="error-title">Zugriff verweigert</h1>
        </div>
      </template>
      <template #content>
        <p class="error-text">
          Das Benutzerkonto ist erfolgreich angemeldet, verfügt aber nicht über die notwendigen
          Berechtigungen, um diese Seite aufzurufen.
        </p>
        <Button
          label="Zurück zur Startseite"
          icon="pi pi-home"
          class="error-action"
          @click="router.push({ name: 'home' })"
        />
      </template>
    </Card>
  </div>
</template>

<style scoped>
.error-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  min-height: 60vh;
}

.error-card {
  max-width: 450px;
  text-align: center;
}

.title-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.error-icon-area {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--p-orange-400), var(--p-red-500));
  color: #fff;
  font-size: 2rem;
}

.error-title {
  margin: 0;
  font-size: 1.5rem;
}

.error-text {
  margin-bottom: 1.5rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

.error-action {
  width: 100%;
}
</style>
