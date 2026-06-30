<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useArchiveDownload } from '@/composables/useArchiveDownload'

const props = defineProps<{
  extension: string | null
  isImage: boolean
  fileId?: number
  size?: 'xs' | 'md'
  trash?: boolean
}>()

const { loadPresignedUrl } = useArchiveDownload()
const thumbSrc = ref<string | null>(null)
const rootEl = ref<HTMLElement | null>(null)
const wasVisible = ref(false)
const observer = ref<IntersectionObserver | null>(null)

const iconClass = computed(() => {
  const ext = (props.extension || '').toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'png':
      return 'pi pi-image'
    case 'doc':
    case 'docx':
      return 'pi pi-file-word'
    case 'xls':
    case 'xlsx':
      return 'pi pi-file-excel'
    case 'pdf':
      return 'pi pi-file-pdf'
    case 'mp4':
    case 'avi':
      return 'pi pi-play'
    default:
      return 'pi pi-file'
  }
})

const loadThumb = async () => {
  thumbSrc.value = null
  if (!props.isImage || props.trash || !props.fileId) return
  thumbSrc.value = await loadPresignedUrl(props.fileId, props.size || 'xs')
}

const tryLoad = () => {
  if (wasVisible.value) loadThumb()
}

watch(
  () => [props.fileId, props.isImage, props.trash],
  () => tryLoad(),
)

onMounted(() => {
  if (!props.isImage || props.trash || !props.fileId) return
  observer.value = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !wasVisible.value) {
        wasVisible.value = true
        loadThumb()
        observer.value?.disconnect()
      }
    },
    { rootMargin: '200px' },
  )
  if (rootEl.value) observer.value.observe(rootEl.value)
})

onUnmounted(() => observer.value?.disconnect())
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
