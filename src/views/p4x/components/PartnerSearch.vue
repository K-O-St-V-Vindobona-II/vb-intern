<script setup lang="ts">
import p4xService from '@/services/p4xService'
import type { PartnerSearchResult } from '@/types/p4x'
import PersonSearchField from '@/components/PersonSearchField.vue'
import type { SearchResult } from '@/components/PersonSearchField.vue'

const model = defineModel<PartnerSearchResult | null>({ required: true })

const searchPartners = async (query: string): Promise<PartnerSearchResult[]> => {
  const resp = await p4xService.searchPartners(query)
  return resp.data
}

const onSelect = (item: SearchResult) => {
  model.value = item as PartnerSearchResult
}
</script>

<template>
  <PersonSearchField
    :search-fn="searchPartners"
    placeholder="Partner suchen..."
    @select="onSelect"
  />
</template>
