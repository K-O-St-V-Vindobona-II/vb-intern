import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PartnerLabel from '../PartnerLabel.vue'
import type { PartnerRef } from '@/types/p4x'

describe('PartnerLabel', () => {
  it('shows the German type label and name for a member', () => {
    const partner: PartnerRef = { type: 'member', id: 1, cn: 'Max Mustermann' }
    const wrapper = mount(PartnerLabel, { props: { partner } })
    expect(wrapper.text()).toContain('Mitglied:')
    expect(wrapper.text()).toContain('Max Mustermann')
    expect(wrapper.find('.pi-user').exists()).toBe(true)
  })

  it('falls back to the raw type and question icon for an unknown type', () => {
    const partner: PartnerRef = { type: 'unknown', id: 1, cn: 'Sonstiges' }
    const wrapper = mount(PartnerLabel, { props: { partner } })
    expect(wrapper.text()).toContain('unknown:')
    expect(wrapper.find('.pi-question').exists()).toBe(true)
  })

  it('does not show a delegating partner row by default', () => {
    const partner: PartnerRef = { type: 'account', id: 1, cn: 'Kasse' }
    const wrapper = mount(PartnerLabel, { props: { partner } })
    expect(wrapper.find('.delegating').exists()).toBe(false)
  })

  it('shows the delegating partner when given', () => {
    const partner: PartnerRef = { type: 'special', id: 1, cn: 'Sammelkonto' }
    const delegatingPartner: PartnerRef = { type: 'contact', id: 2, cn: 'Firma GmbH' }
    const wrapper = mount(PartnerLabel, { props: { partner, delegatingPartner } })
    expect(wrapper.find('.delegating').exists()).toBe(true)
    expect(wrapper.text()).toContain('Kontakt:')
    expect(wrapper.text()).toContain('Firma GmbH')
  })
})
