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
            <i class="pi pi-question-circle" />
          </div>
          <h1 class="error-title">Seite nicht gefunden</h1>
        </div>
      </template>
      <template #content>
        <p class="error-text">Die angeforderte Seite existiert nicht oder wurde verschoben.</p>
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
  padding: 1rem;
  min-height: 60vh;
}

.error-card {
  max-width: 100%;
  text-align: center;
}

.title-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.error-icon-area {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--p-blue-400), var(--p-indigo-500));
  color: #fff;
  font-size: 1.5rem;
}

.error-title {
  margin: 0;
  font-size: 1.25rem;
}

.error-text {
  margin-bottom: 1rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
  font-size: 0.9rem;
}

.error-action {
  width: 100%;
}

@media (min-width: 600px) {
  .error-wrapper {
    padding: 2rem;
  }

  .error-card {
    max-width: 450px;
  }

  .title-container {
    gap: 0.75rem;
  }

  .error-icon-area {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    font-size: 2rem;
  }

  .error-title {
    font-size: 1.5rem;
  }

  .error-text {
    margin-bottom: 1.5rem;
    font-size: 1rem;
  }
}
</style>
