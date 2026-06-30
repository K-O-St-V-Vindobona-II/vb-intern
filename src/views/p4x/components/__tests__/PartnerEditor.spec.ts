import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PartnerEditor from '../PartnerEditor.vue'
import PrimeVue from 'primevue/config'
import type { P4xTransaction } from '@/types/p4x'

const mockSetTransactionPartner = vi.fn()
vi.mock('@/services/p4xService', () => ({
  default: {
    setTransactionPartner: (...args: unknown[]) => mockSetTransactionPartner(...args),
    searchPartners: vi.fn().mockResolvedValue({ data: [] }),
  },
}))

function buildTransaction(overrides: Partial<P4xTransaction> = {}): P4xTransaction {
  return {
    id: 1,
    booking: '2026-06-01',
    valuation: '2026-06-01',
    iban: 'AT001234',
    amount: 10,
    subject: 'Spende',
    p4x_account_id: 1,
    p4x_account_cn: 'Kasse',
    p4x_account_iban: 'AT00',
    comment: null,
    has_attachment: false,
    partner: null,
    delegating_partner: null,
    p4x_category_directs: [],
    p4x_category_filters: [],
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

describe('PartnerEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetTransactionPartner.mockResolvedValue({ data: buildTransaction() })
  })

  it('does not show the delegating-partner section before a partner is selected', async () => {
    const wrapper = mount(PartnerEditor, {
      props: { transaction: buildTransaction() },
      ...mountOpts,
    })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    expect(wrapper.findAllComponents({ name: 'PartnerSearch' })).toHaveLength(1)
    wrapper.unmount()
  })

  it('pre-fills the partner from the transaction when opened', async () => {
    const transaction = buildTransaction({
      partner: { type: 'member', id: 5, cn: 'Max Mustermann' },
    })
    const wrapper = mount(PartnerEditor, { props: { transaction }, ...mountOpts })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const partnerSearch = wrapper.findComponent({ name: 'PartnerSearch' })
    expect(partnerSearch.props('modelValue')).toEqual({
      type: 'member',
      id: 5,
      label: 'Max Mustermann',
    })
    wrapper.unmount()
  })

  it('shows the delegating partner search once the checkbox is enabled', async () => {
    const transaction = buildTransaction({ partner: { type: 'member', id: 5, cn: 'Max' } })
    const wrapper = mount(PartnerEditor, { props: { transaction }, ...mountOpts })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    await wrapper.findComponent({ name: 'Checkbox' }).vm.$emit('update:modelValue', true)

    expect(wrapper.findAllComponents({ name: 'PartnerSearch' })).toHaveLength(2)
    wrapper.unmount()
  })

  it('saves the partner and delegating partner and emits changed', async () => {
    const transaction = buildTransaction({ id: 9 })
    const updated = buildTransaction({ id: 9, partner: { type: 'member', id: 5, cn: 'Max' } })
    mockSetTransactionPartner.mockResolvedValue({ data: updated })
    const wrapper = mount(PartnerEditor, { props: { transaction }, ...mountOpts })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()

    const partnerSearch = wrapper.findComponent({ name: 'PartnerSearch' })
    await partnerSearch.vm.$emit('update:modelValue', { type: 'member', id: 5, label: 'Max' })
    await wrapper.findComponent({ name: 'Checkbox' }).vm.$emit('update:modelValue', true)
    const delegatingSearch = wrapper.findAllComponents({ name: 'PartnerSearch' })[1]!
    await delegatingSearch.vm.$emit('update:modelValue', { type: 'contact', id: 7, label: 'Firma' })

    // Dialog content is teleported to document.body, outside the wrapper's DOM subtree.
    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Speichern',
    )!
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mockSetTransactionPartner).toHaveBeenCalledWith(9, {
      partner: { type: 'member', id: 5, cn: 'Max' },
      hasDelegatingPartner: true,
      delegatingPartner: { type: 'contact', id: 7, cn: 'Firma' },
    })
    expect(wrapper.emitted('changed')).toEqual([[updated]])
    wrapper.unmount()
  })

  it('clears the delegating partner when the main partner is cleared', async () => {
    const transaction = buildTransaction({
      partner: { type: 'member', id: 5, cn: 'Max' },
      delegating_partner: { type: 'contact', id: 7, cn: 'Firma' },
    })
    const wrapper = mount(PartnerEditor, { props: { transaction }, ...mountOpts })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()
    // The fixture already has a delegating partner, so both searches start visible.
    expect(wrapper.findAllComponents({ name: 'PartnerSearch' })).toHaveLength(2)

    await wrapper.findComponent({ name: 'PartnerSearch' }).vm.$emit('update:modelValue', null)

    expect(wrapper.findComponent({ name: 'Checkbox' }).exists()).toBe(false)
    wrapper.unmount()
  })
})
