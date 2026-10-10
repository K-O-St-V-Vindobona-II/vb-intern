import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WarningLabel from '../WarningLabel.vue'

describe('WarningLabel', () => {
  it('renders the given label text', () => {
    const wrapper = mount(WarningLabel, { props: { label: 'Kein Partner zugeordnet' } })
    expect(wrapper.text()).toContain('Kein Partner zugeordnet')
  })

  it('shows a warning icon', () => {
    const wrapper = mount(WarningLabel, { props: { label: 'Warnung' } })
    expect(wrapper.find('.pi-exclamation-triangle').exists()).toBe(true)
  })

  it('hides the decorative icon from assistive technology, the text carries the warning', () => {
    const wrapper = mount(WarningLabel, { props: { label: 'Kein Partner gesetzt!' } })

    expect(wrapper.find('.pi-exclamation-triangle').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toBe('Kein Partner gesetzt!')
  })
})
