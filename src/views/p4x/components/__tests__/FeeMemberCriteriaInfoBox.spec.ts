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
})
