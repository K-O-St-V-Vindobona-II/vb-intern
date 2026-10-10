import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FeeMemberCriteriaInfoBox from '../FeeMemberCriteriaInfoBox.vue'

describe('FeeMemberCriteriaInfoBox', () => {
  it('starts collapsed, content not rendered', () => {
    const wrapper = mount(FeeMemberCriteriaInfoBox)
    expect(wrapper.find('.criteria-info-content').exists()).toBe(false)
    expect(wrapper.find('.pi-chevron-right').exists()).toBe(true)
  })

  it('expands and shows the criteria explanation on click', async () => {
    const wrapper = mount(FeeMemberCriteriaInfoBox)
    await wrapper.find('.criteria-info-toggle').trigger('click')

    expect(wrapper.find('.criteria-info-content').exists()).toBe(true)
    expect(wrapper.find('.pi-chevron-down').exists()).toBe(true)
    expect(wrapper.text()).toContain('Urphilister')
    expect(wrapper.text()).toContain('K.Ö.St.V. Vindobona II')
  })

  it('collapses again on a second click', async () => {
    const wrapper = mount(FeeMemberCriteriaInfoBox)
    const toggle = wrapper.find('.criteria-info-toggle')
    await toggle.trigger('click')
    await toggle.trigger('click')

    expect(wrapper.find('.criteria-info-content').exists()).toBe(false)
  })

  it('is a real button that reports whether it is expanded', async () => {
    const wrapper = mount(FeeMemberCriteriaInfoBox)
    const toggle = wrapper.find('button.criteria-info-toggle')

    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('type')).toBe('button')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.criteria-info-icon').attributes('aria-hidden')).toBe('true')

    await toggle.trigger('click')

    expect(toggle.attributes('aria-expanded')).toBe('true')
  })

  it('states the full criterion for a fee-liable member and what the balance list adds', async () => {
    const wrapper = mount(FeeMemberCriteriaInfoBox)
    await wrapper.find('.criteria-info-toggle').trigger('click')

    const paragraphs = wrapper.findAll('.criteria-info-content p').map((p) => p.text())
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0]).toBe(
      'Als beitragspflichtig gilt, wer bei der K.Ö.St.V. Vindobona II als Urphilister geführt wird, nicht entlassen und nicht verstorben ist.',
    )
    expect(paragraphs[1]).toContain(
      'Die Saldenliste zeigt zusätzlich nur jene beitragspflichtigen Mitglieder',
    )
    expect(paragraphs[1]).toContain('(Initialdatum)')
  })
})
