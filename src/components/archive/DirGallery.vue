<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { FileShort } from '@/types/archive'
import { useArchiveDownload } from '@/composables/useArchiveDownload'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

const props = defineProps<{
  files: FileShort[]
}>()

const { loadPresignedUrl, triggerDownload } = useArchiveDownload()

const images = computed(() => props.files.filter((f) => f.type === 'file' && f.is_image))

const visible = ref(false)
const currentIndex = ref(0)
const currentSrc = ref<string | null>(null)
const loading = ref(false)

const currentImage = computed(() => images.value[currentIndex.value] || null)

let loadRequestId = 0

const loadCurrent = async () => {
  if (!currentImage.value) return
  // Guard against race condition when rapidly clicking prev/next
  const thisRequest = ++loadRequestId
  loading.value = true
  const url = await loadPresignedUrl(currentImage.value.id, 'lg')
  if (thisRequest !== loadRequestId) return
  currentSrc.value = url
  loading.value = false
}

watch(currentIndex, () => loadCurrent())

const open = () => {
  currentIndex.value = 0
  visible.value = true
  loadCurrent()
}

const prev = () => {
  currentIndex.value = currentIndex.value > 0 ? currentIndex.value - 1 : images.value.length - 1
}

const next = () => {
  currentIndex.value = currentIndex.value < images.value.length - 1 ? currentIndex.value + 1 : 0
}

const download = () => {
  if (!currentImage.value) return
  const img = currentImage.value
  triggerDownload(img.id, `${img.name}.${img.extension}`)
}
</script>

<template>
  <Button
    v-if="images.length"
    label="Galerie anzeigen"
    icon="pi pi-images"
    severity="primary"
    class="gallery-btn"
    @click="open"
  />

  <Dialog
    v-model:visible="visible"
    header="Galerie"
    modal
    :style="{ width: '800px' }"
    :breakpoints="{ '900px': '95vw' }"
  >
    <div v-if="currentImage" class="gallery-content">
      <div class="gallery-nav">
        <Button icon="pi pi-chevron-left" severity="primary" @click="prev" />
        <Button icon="pi pi-chevron-right" severity="primary" @click="next" />
      </div>

      <div class="gallery-image">
        <img
          v-if="currentSrc"
          :src="currentSrc"
          :alt="currentImage.name || ''"
          class="gallery-img"
          @click="download"
        />
        <i v-else-if="loading" class="pi pi-spin pi-spinner gallery-spinner" />
      </div>

      <div class="gallery-info">
        <div class="gallery-counter">
          {{ currentIndex + 1 }} /
          {{ images.length }}
        </div>
        <h5>{{ currentImage.name }}.{{ currentImage.extension }}</h5>
        <p v-if="currentImage.description">
          {{ currentImage.description }}
        </p>
        <Button
          icon="pi pi-download"
          label="Herunterladen"
          severity="secondary"
          size="small"
          @click="download"
        />
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.gallery-btn {
  margin: 0.75rem 0;
}
.gallery-content {
  text-align: center;
}
.gallery-nav {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
}
.gallery-image {
  margin-bottom: 1rem;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gallery-img {
  max-width: 100%;
  max-height: 500px;
  border-radius: 4px;
  cursor: pointer;
}
.gallery-spinner {
  font-size: 2rem;
  color: var(--p-text-muted-color);
}
.gallery-info h5 {
  margin: 0.5rem 0 0.25rem;
}
.gallery-info p {
  color: var(--p-text-muted-color);
  margin: 0 0 0.5rem;
}
.gallery-counter {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}
</style>
