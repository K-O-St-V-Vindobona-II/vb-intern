import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FormAmount from '../FormAmount.vue'
import PrimeVue from 'primevue/config'

describe('FormAmount', () => {
  it('renders an InputNumber configured for EUR currency', () => {
    const wrapper = mount(FormAmount, {
      props: { modelValue: 12.5, 'onUpdate:modelValue': () => {} },
      global: { plugins: [PrimeVue] },
    })
    const input = wrapper.findComponent({ name: 'InputNumber' })
    expect(input.props('mode')).toBe('currency')
    expect(input.props('currency')).toBe('EUR')
    expect(input.props('locale')).toBe('de-AT')
  })

  it('emits update:modelValue when the value changes', async () => {
    const wrapper = mount(FormAmount, {
      props: { modelValue: 0 },
      global: { plugins: [PrimeVue] },
    })
    await wrapper.findComponent({ name: 'InputNumber' }).vm.$emit('update:modelValue', 42)
    expect(wrapper.emitted('update:modelValue')).toEqual([[42]])
  })
})
