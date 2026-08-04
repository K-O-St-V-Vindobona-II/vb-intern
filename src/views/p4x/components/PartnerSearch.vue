<script setup lang="ts">
import p4xService from '@/services/p4xService'
import type { PartnerSearchResult } from '@/types/p4x'
import SearchField from '@/components/SearchField.vue'
import type { SearchResult } from '@/components/SearchField.vue'

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
  <SearchField :search-fn="searchPartners" placeholder="Partner suchen..." @select="onSelect" />
</template>
