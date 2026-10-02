<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useArchiveDownload } from '@/composables/useArchiveDownload'
import { useThumbnailLoadQueue } from '@/composables/useThumbnailLoadQueue'

const props = defineProps<{
  extension: string | null
  isImage: boolean
  fileId?: string
  size?: 'xs' | 'md'
}>()

const { loadPresignedUrl } = useArchiveDownload()
const { schedule } = useThumbnailLoadQueue()
const thumbSrc = ref<string | null>(null)
const rootEl = ref<HTMLElement | null>(null)

// Plain variables: nothing in the template reads them. wasVisible stays true
// for the life of the instance once the icon has been on screen, so a row
// that is re-used for another file (DataTable rows without a data-key are
// keyed by position and re-render in place when the list is sorted) reloads
// its thumbnail straight away.
let wasVisible = false
let observer: IntersectionObserver | null = null

// Answers arrive in any order (the load queue runs several tasks at once):
// only the newest request may set the thumbnail, or a re-used row could end
// up showing the picture of the file it displayed before.
let latestRequestId = 0

const EXTENSION_ICONS: Record<string, string> = {
  jpg: 'pi pi-image',
  jpeg: 'pi pi-image',
  gif: 'pi pi-image',
  png: 'pi pi-image',
  doc: 'pi pi-file-word',
  docx: 'pi pi-file-word',
  xls: 'pi pi-file-excel',
  xlsx: 'pi pi-file-excel',
  pdf: 'pi pi-file-pdf',
  mp4: 'pi pi-play',
  avi: 'pi pi-play',
}

const iconClass = computed(() => {
  const ext = (props.extension || '').toLowerCase()
  return EXTENSION_ICONS[ext] ?? 'pi pi-file'
})

const loadThumb = async () => {
  const requestId = ++latestRequestId
  thumbSrc.value = null
  if (!props.isImage || !props.fileId) return
  const fileId = props.fileId
  const size = props.size || 'xs'
  const url = await schedule(() => loadPresignedUrl(fileId, size))
  if (requestId !== latestRequestId) return
  thumbSrc.value = url
}

const stopObserving = () => {
  observer?.disconnect()
  observer = null
}

const startObserving = () => {
  if (observer || !rootEl.value) return
  observer = new IntersectionObserver(
    (entries) => {
      if (!entries[0]?.isIntersecting) return
      wasVisible = true
      stopObserving()
      loadThumb()
    },
    { rootMargin: '200px' },
  )
  observer.observe(rootEl.value)
}

// A re-used instance can turn from "no image" into an image after its
// mount; observing only from onMounted would then never load its thumbnail.
const refresh = () => {
  if (wasVisible) {
    loadThumb()
    return
  }
  if (props.isImage && props.fileId) startObserving()
  else stopObserving()
}

watch(() => [props.fileId, props.isImage], refresh)

onMounted(() => {
  if (props.isImage && props.fileId) startObserving()
})

onUnmounted(stopObserving)
</script>

<template>
  <span ref="rootEl">
    <img
      v-if="thumbSrc"
      :src="thumbSrc"
      alt=""
      class="file-thumb"
      :class="{ 'thumb-md': size === 'md' }"
    />
    <i v-else :class="iconClass" />
  </span>
</template>

<style scoped>
.file-thumb {
  width: 16px;
  height: 16px;
  object-fit: cover;
  vertical-align: middle;
}
.thumb-md {
  width: 256px;
  height: auto;
  max-height: 256px;
  object-fit: contain;
}
</style>
