import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PartnerSearch from '../PartnerSearch.vue'
import PrimeVue from 'primevue/config'
import type { PartnerSearchResult } from '@/types/p4x'

const mockSearchPartners = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: { searchPartners: (...args: unknown[]) => mockSearchPartners(...args) },
}))

describe('PartnerSearch', () => {
  beforeEach(() => {
    mockSearchPartners.mockReset()
  })

  it('forwards the query to p4xService.searchPartners and returns the results', async () => {
    const results: PartnerSearchResult[] = [{ id: 1, label: 'Max Mustermann', type: 'member' }]
    mockSearchPartners.mockResolvedValue({ data: results })

    const wrapper = mount(PartnerSearch, {
      props: { modelValue: null },
      global: { plugins: [PrimeVue] },
    })
    const field = wrapper.findComponent({ name: 'PersonSearchField' })
    const found = await (field.props('searchFn') as (q: string) => Promise<PartnerSearchResult[]>)(
      'Max',
    )

    expect(mockSearchPartners).toHaveBeenCalledWith('Max')
    expect(found).toEqual(results)
  })

  it('emits update:modelValue when a result is selected', async () => {
    const wrapper = mount(PartnerSearch, {
      props: { modelValue: null },
      global: { plugins: [PrimeVue] },
    })
    const field = wrapper.findComponent({ name: 'PersonSearchField' })
    const selected = { id: 1, label: 'Max Mustermann', type: 'member' }

    await field.vm.$emit('select', selected)

    expect(wrapper.emitted('update:modelValue')).toEqual([[selected]])
  })
})
