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
})
