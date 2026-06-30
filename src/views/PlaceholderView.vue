<script setup lang="ts">
import { useRoute } from 'vue-router'
import Card from 'primevue/card'

const route = useRoute()
const moduleName = (route.meta.moduleName as string) ?? 'Dieses Modul'
</script>

<template>
  <div class="placeholder-view">
    <Card class="placeholder-card">
      <template #content>
        <div class="placeholder-content">
          <div class="placeholder-icon-area">
            <i class="pi pi-wrench" />
          </div>
          <h2 class="placeholder-title">
            {{ moduleName }}
          </h2>
          <p class="placeholder-text">
            Dieses Modul wird derzeit migriert und ist bald verfügbar. Bis dahin kannst du die alte
            Anwendung nutzen.
          </p>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.placeholder-view {
  max-width: 500px;
  margin: 4rem auto 0;
}

.placeholder-card {
  text-align: center;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 0;
}

.placeholder-icon-area {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--p-surface-300), var(--p-surface-400));
  color: #fff;
  font-size: 1.8rem;
}

.placeholder-title {
  margin: 0;
  font-size: 1.3rem;
}

.placeholder-text {
  margin: 0;
  color: var(--p-text-muted-color);
  line-height: 1.5;
  font-size: 0.9rem;
}
</style>
