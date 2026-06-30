import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Amount from '../Amount.vue'

describe('Amount', () => {
  it('formats a positive amount as EUR currency with the positive class', () => {
    const wrapper = mount(Amount, { props: { amount: 12.5 } })
    expect(wrapper.classes()).toContain('amount-positive')
    expect(wrapper.text()).toContain('12,50')
    expect(wrapper.text()).toContain('€')
  })

  it('formats a negative amount with the negative class', () => {
    const wrapper = mount(Amount, { props: { amount: -3.2 } })
    expect(wrapper.classes()).toContain('amount-negative')
  })

  it('treats zero as non-negative', () => {
    const wrapper = mount(Amount, { props: { amount: 0 } })
    expect(wrapper.classes()).toContain('amount-positive')
  })
})
