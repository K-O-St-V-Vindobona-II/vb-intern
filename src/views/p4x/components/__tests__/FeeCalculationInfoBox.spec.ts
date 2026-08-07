import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FeeCalculationInfoBox from '../FeeCalculationInfoBox.vue'

describe('FeeCalculationInfoBox', () => {
  it('starts collapsed, content not rendered', () => {
    const wrapper = mount(FeeCalculationInfoBox, {
      props: { context: 'self', cutoverDate: '2026-09-01' },
    })
    expect(wrapper.find('.fee-info-content').exists()).toBe(false)
    expect(wrapper.find('.pi-chevron-right').exists()).toBe(true)
  })

  it('expands and shows the explanation on click', async () => {
    const wrapper = mount(FeeCalculationInfoBox, {
      props: { context: 'self', cutoverDate: '2026-09-01' },
    })
    await wrapper.find('.fee-info-toggle').trigger('click')

    expect(wrapper.find('.fee-info-content').exists()).toBe(true)
    expect(wrapper.find('.pi-chevron-down').exists()).toBe(true)
    expect(wrapper.text()).toContain('1. September 2026')
  })

  it('collapses again on a second click', async () => {
    const wrapper = mount(FeeCalculationInfoBox, {
      props: { context: 'self', cutoverDate: '2026-09-01' },
    })
    const toggle = wrapper.find('.fee-info-toggle')
    await toggle.trigger('click')
    await toggle.trigger('click')

    expect(wrapper.find('.fee-info-content').exists()).toBe(false)
  })

  it('shows the self-service closing line for context="self"', async () => {
    const wrapper = mount(FeeCalculationInfoBox, {
      props: { context: 'self', cutoverDate: '2026-09-01' },
    })
    await wrapper.find('.fee-info-toggle').trigger('click')

    expect(wrapper.text()).toContain('Fragen zu deinem Zahlungsrhythmus')
    expect(wrapper.text()).not.toContain('Fragen zum Zahlungsrhythmus dieses Mitglieds')
  })

  it('shows the admin closing line for context="admin"', async () => {
    const wrapper = mount(FeeCalculationInfoBox, {
      props: { context: 'admin', cutoverDate: '2026-09-01' },
    })
    await wrapper.find('.fee-info-toggle').trigger('click')

    expect(wrapper.text()).toContain('Fragen zum Zahlungsrhythmus dieses Mitglieds')
    expect(wrapper.text()).not.toContain('Fragen zu deinem Zahlungsrhythmus')
  })
})
