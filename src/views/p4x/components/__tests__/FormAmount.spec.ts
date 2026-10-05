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

  it('reports a cleared field as 0, never as null', async () => {
    const wrapper = mount(FormAmount, {
      props: { modelValue: 12 },
      global: { plugins: [PrimeVue] },
    })

    await wrapper.findComponent({ name: 'InputNumber' }).vm.$emit('update:modelValue', null)

    expect(wrapper.emitted('update:modelValue')).toEqual([[0]])
  })

  it('reports the value 0 when the user empties the field', async () => {
    const wrapper = mount(FormAmount, {
      props: { modelValue: 12.5 },
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })
    const input = wrapper.find('input')

    await input.setValue('')
    await input.trigger('blur')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0])
    wrapper.unmount()
  })

  it('shows the amount with two decimals and the Austrian separators', () => {
    const wrapper = mount(FormAmount, {
      props: { modelValue: 1234.5 },
      global: { plugins: [PrimeVue] },
    })

    expect(wrapper.find('input').element.value.replace(/\s/g, ' ')).toBe('€ 1.234,50')
  })
})
