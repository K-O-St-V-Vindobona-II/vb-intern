<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { formatApiError } from '@/utils/formatters'
import { siteSettingsService } from '@/services/publicContentService'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'

const toast = useToast()

const loading = ref(true)
const saving = ref(false)

const heading = ref('')
const youtubeUrl = ref('')
// calendar_id/gallery_heading belong to the Programm/Galerie admin views,
// but all live in the same settings resource on the backend - fetched
// here and resent unchanged on save so we never accidentally clear them.
const calendarId = ref('')
const galleryHeading = ref('')

const previewYoutubeId = ref<string | null>(null)
const previewSrc = computed(() =>
  previewYoutubeId.value
    ? `https://www.youtube.com/embed/${previewYoutubeId.value}?wmode=transparent&autoplay=0`
    : null,
)

const loadSettings = async () => {
  loading.value = true
  try {
    const resp = await siteSettingsService.getSettings()
    heading.value = resp.data.about_video_heading
    youtubeUrl.value = `https://www.youtube.com/watch?v=${resp.data.about_video_youtube_id}`
    calendarId.value = resp.data.programm_calendar_id
    galleryHeading.value = resp.data.gallery_heading
    previewYoutubeId.value = resp.data.about_video_youtube_id
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Einstellungen konnten nicht geladen werden.'),
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}

const save = async () => {
  saving.value = true
  try {
    const resp = await siteSettingsService.updateSettings({
      about_video_heading: heading.value,
      youtube_url: youtubeUrl.value,
      calendar_id: calendarId.value,
      gallery_heading: galleryHeading.value,
    })
    heading.value = resp.data.about_video_heading
    youtubeUrl.value = `https://www.youtube.com/watch?v=${resp.data.about_video_youtube_id}`
    previewYoutubeId.value = resp.data.about_video_youtube_id
    toast.add({
      severity: 'success',
      summary: 'Gespeichert',
      detail: 'Video-Einstellungen wurden gespeichert.',
      life: 3000,
    })
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Fehler',
      detail: formatApiError(err, 'Speichern fehlgeschlagen.'),
      life: 5000,
    })
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="video-admin">
    <template v-if="!loading">
      <div class="page-header">
        <h2 class="page-title">www-Administration</h2>
        <h3 class="page-subtitle">Video</h3>
      </div>

      <div class="field">
        <label for="video-heading">Überschrift</label>
        <InputText id="video-heading" v-model="heading" maxlength="200" class="w-full" />
      </div>

      <div class="field">
        <label for="video-url">YouTube-Link</label>
        <InputText
          id="video-url"
          v-model="youtubeUrl"
          class="w-full"
          placeholder="z. B. https://www.youtube.com/watch?v=..."
        />
        <p class="field-hint">
          Ganz normaler YouTube-Link (Teilen-Link, Adressleiste oder Kurzlink) — wird automatisch
          erkannt.
        </p>
      </div>

      <div class="actions">
        <Button label="Speichern" icon="pi pi-check" :loading="saving" @click="save" />
      </div>

      <div v-if="previewSrc" class="preview">
        <p class="preview-label">Vorschau</p>
        <p class="preview-heading">{{ heading }}</p>
        <iframe :src="previewSrc" title="Video-Vorschau" loading="lazy" allowfullscreen />
      </div>
    </template>
  </div>
</template>

<style scoped>
.video-admin {
  max-width: 700px;
  margin: 0 auto;
  width: 100%;
}

.page-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.page-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
}

.page-subtitle {
  margin: 0.25rem 0 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.field {
  margin-bottom: 1.25rem;
}

.field label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
}

.field-hint {
  margin: 0.35rem 0 0;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
}

.w-full {
  width: 100%;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 2rem;
}

.preview {
  border-top: 1px solid var(--p-surface-200);
  padding-top: 1.5rem;
}

.preview-label {
  font-weight: 700;
  font-size: 0.85rem;
  margin: 0 0 0.5rem;
}

.preview-heading {
  font-style: italic;
  color: var(--p-text-muted-color);
  margin: 0 0 0.75rem;
}

.preview iframe {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: none;
  border-radius: 8px;
}
</style>
