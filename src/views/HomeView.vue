<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const tiles = [
  {
    title: 'Upload-Center',
    description: 'Dateien ins Archiv hochladen',
    icon: 'pi pi-cloud-upload',
    route: 'archive-upload',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    title: 'Mitgliederverwaltung',
    description: 'Mitglieder und Kontakte einsehen',
    icon: 'pi pi-users',
    route: 'standesdb-dashboard',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  {
    title: 'Archiv',
    description: 'Dokumente und Fotos durchsuchen',
    icon: 'pi pi-folder-open',
    route: 'archive-root',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  {
    title: 'Zahlungsinformation',
    description: 'Bankverbindung und AH-Beitrag',
    icon: 'pi pi-credit-card',
    route: 'payment-info',
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  },
]
</script>

<template>
  <div class="home-wrapper">
    <h1 class="home-title">Willkommen im internen Bereich</h1>
    <p v-if="authStore.user" class="home-subtitle">
      {{ authStore.user.cn }}
    </p>

    <div class="tiles-grid">
      <div
        v-for="tile in tiles"
        :key="tile.route"
        class="tile"
        @click="router.push({ name: tile.route })"
      >
        <div class="tile-icon-area" :style="{ background: tile.gradient }">
          <i :class="tile.icon" />
        </div>
        <div class="tile-body">
          <h3 class="tile-title">
            {{ tile.title }}
          </h3>
          <p class="tile-desc">
            {{ tile.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-wrapper {
  max-width: 800px;
  margin: 0 auto;
}

.home-title {
  font-size: 1.8rem;
  text-align: center;
  margin-bottom: 0.75rem;
  color: var(--p-text-color);
}

.home-subtitle {
  text-align: center;
  font-size: 1.05rem;
  color: var(--p-text-muted-color);
  margin: 0 0 2rem;
}

.tiles-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .tiles-grid {
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }
}

.tile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 12px;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.tile:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.tile:active {
  transform: translateY(-1px);
}

.tile-icon-area {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  min-width: 56px;
  border-radius: 14px;
  color: #fff;
}

.tile-icon-area .pi {
  font-size: 1.6rem;
}

.tile-body {
  flex: 1;
  min-width: 0;
}

.tile-title {
  margin: 0 0 0.15rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.tile-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

@media (min-width: 768px) {
  .tile {
    gap: 1rem;
    padding: 1.5rem;
  }

  .tile-icon-area {
    width: 72px;
    height: 72px;
    min-width: 72px;
    border-radius: 16px;
  }

  .tile-icon-area .pi {
    font-size: 2.2rem;
  }

  .tile-title {
    font-size: 1.15rem;
  }

  .tile-desc {
    font-size: 0.9rem;
  }
}
</style>
