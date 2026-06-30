<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import standesdbService from '@/services/standesdbService'
import Avatar from 'primevue/avatar'

const props = defineProps<{
  imageId: number | null | undefined
  ownerType: 'member' | 'contact'
  ownerId: number
}>()

const imageUrl = ref<string | null>(null)
let loadRequestId = 0

const loadImage = async () => {
  imageUrl.value = null
  if (!props.imageId) return

  const thisRequest = ++loadRequestId
  try {
    const resp = await standesdbService.getImageUrl(
      props.ownerType,
      props.ownerId,
      props.imageId,
      true,
    )
    if (thisRequest !== loadRequestId) return
    imageUrl.value = resp.data.url
  } catch {
    if (thisRequest !== loadRequestId) return
    imageUrl.value = null
  }
}

onMounted(loadImage)
watch(() => props.imageId, loadImage)
</script>

<template>
  <div class="image-preview">
    <img v-if="imageUrl" :src="imageUrl" alt="Profilbild" class="profile-image" />
    <Avatar v-else icon="pi pi-user" size="xlarge" shape="circle" class="placeholder-avatar" />
  </div>
</template>

<style scoped>
.profile-image {
  max-width: 150px;
  max-height: 200px;
  border-radius: 8px;
  border: 2px solid var(--p-surface-200);
  object-fit: contain;
}

.placeholder-avatar {
  width: 120px !important;
  height: 120px !important;
  font-size: 3rem !important;
  background-color: var(--p-surface-100);
  color: var(--p-text-muted-color);
}
</style>
