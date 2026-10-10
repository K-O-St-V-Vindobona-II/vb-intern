import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PartnerLabel from '../PartnerLabel.vue'
import type { PartnerRef } from '@/types/p4x'

describe('PartnerLabel', () => {
  it('shows the German type label and name for a member', () => {
    const partner: PartnerRef = { type: 'member', id: 'member-uuid-1', cn: 'Max Mustermann' }
    const wrapper = mount(PartnerLabel, { props: { partner } })
    expect(wrapper.text()).toContain('Mitglied:')
    expect(wrapper.text()).toContain('Max Mustermann')
    expect(wrapper.find('.pi-user').exists()).toBe(true)
  })

  it('falls back to the raw type and question icon for an unknown type', () => {
    const partner: PartnerRef = { type: 'unknown', id: 'member-uuid-1', cn: 'Sonstiges' }
    const wrapper = mount(PartnerLabel, { props: { partner } })
    expect(wrapper.text()).toContain('unknown:')
    expect(wrapper.find('.pi-question').exists()).toBe(true)
  })

  it('does not show a delegating partner row by default', () => {
    const partner: PartnerRef = { type: 'account', id: 'account-uuid-1', cn: 'Kasse' }
    const wrapper = mount(PartnerLabel, { props: { partner } })
    expect(wrapper.find('.delegating').exists()).toBe(false)
  })

  it('shows the delegating partner when given', () => {
    const partner: PartnerRef = { type: 'special', id: 'special-uuid-1', cn: 'Sammelkonto' }
    const delegatingPartner: PartnerRef = {
      type: 'contact',
      id: 'contact-uuid-2',
      cn: 'Firma GmbH',
    }
    const wrapper = mount(PartnerLabel, { props: { partner, delegatingPartner } })
    expect(wrapper.find('.delegating').exists()).toBe(true)
    expect(wrapper.text()).toContain('Kontakt:')
    expect(wrapper.text()).toContain('Firma GmbH')
  })

  it('falls back to the raw type for an unknown type of the delegating partner too', () => {
    const partner: PartnerRef = { type: 'member', id: 'member-uuid-1', cn: 'Max' }
    const delegatingPartner: PartnerRef = { type: 'verein', id: 'x-uuid-1', cn: 'Sonst' }
    const wrapper = mount(PartnerLabel, { props: { partner, delegatingPartner } })

    expect(wrapper.find('.delegating').text()).toContain('verein: Sonst')
  })

  it('hides its icons from assistive technology', () => {
    const partner: PartnerRef = { type: 'member', id: 'member-uuid-1', cn: 'Max' }
    const delegatingPartner: PartnerRef = { type: 'contact', id: 'contact-uuid-2', cn: 'Firma' }
    const wrapper = mount(PartnerLabel, { props: { partner, delegatingPartner } })

    expect(wrapper.findAll('i').length).toBe(2)
    expect(wrapper.findAll('i').every((i) => i.attributes('aria-hidden') === 'true')).toBe(true)
  })

  it.each([
    ['member', 'Mitglied', 'pi-user'],
    ['contact', 'Kontakt', 'pi-building'],
    ['account', 'Konto', 'pi-wallet'],
    ['special', 'Spezial', 'pi-star'],
  ])('shows the type %s as "%s" with the icon %s', (type, label, icon) => {
    const partner: PartnerRef = { type, id: 'x-uuid-1', cn: 'Name' }
    const wrapper = mount(PartnerLabel, { props: { partner } })

    expect(wrapper.find('strong').text()).toBe(`${label}:`)
    expect(wrapper.find('i').classes()).toContain(icon)
  })
})
