import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PermissionGrid from '../PermissionGrid.vue'
import PrimeVue from 'primevue/config'

const orgs = [
  { id: 'vbw', label: 'Wien' },
  { id: 'vbn', label: 'Neustadt' },
]
const states = [{ id: 'active', label: 'Aktiv' }]

describe('PermissionGrid', () => {
  it('renders a header column per org and a row per state', () => {
    const wrapper = mount(PermissionGrid, {
      props: { orgs, states, modelValue: [] },
      global: { plugins: [PrimeVue] },
    })
    expect(wrapper.findAll('thead th')).toHaveLength(3) // 'Status' + 2 orgs
    expect(wrapper.text()).toContain('Wien')
    expect(wrapper.text()).toContain('Neustadt')
    expect(wrapper.text()).toContain('Aktiv')
  })

  it('renders one checkbox per org/state combination', () => {
    const wrapper = mount(PermissionGrid, {
      props: { orgs, states, modelValue: [] },
      global: { plugins: [PrimeVue] },
    })
    expect(wrapper.findAllComponents({ name: 'Checkbox' })).toHaveLength(
      orgs.length * states.length,
    )
  })

  it('disables checkboxes when edit is not set', () => {
    const wrapper = mount(PermissionGrid, {
      props: { orgs, states, modelValue: [] },
      global: { plugins: [PrimeVue] },
    })
    const checkbox = wrapper.findComponent({ name: 'Checkbox' })
    expect(checkbox.props('disabled')).toBe(true)
  })

  it('enables checkboxes when edit is true', () => {
    const wrapper = mount(PermissionGrid, {
      props: { orgs, states, modelValue: [], edit: true },
      global: { plugins: [PrimeVue] },
    })
    const checkbox = wrapper.findComponent({ name: 'Checkbox' })
    expect(checkbox.props('disabled')).toBe(false)
  })

  it('marks a checkbox as checked when its value is in the model', () => {
    const wrapper = mount(PermissionGrid, {
      props: { orgs, states, modelValue: ['vbw_active'] },
      global: { plugins: [PrimeVue] },
    })
    const checkboxes = wrapper.findAllComponents({ name: 'Checkbox' })
    expect(checkboxes[0]!.props('value')).toBe('vbw_active')
    expect(checkboxes[0]!.props('modelValue')).toEqual(['vbw_active'])
  })

  it('scopes the header cells to their column and the state labels to their row', () => {
    const wrapper = mount(PermissionGrid, {
      props: { orgs, states, modelValue: [] },
      global: { plugins: [PrimeVue] },
    })

    expect(wrapper.findAll('thead th').map((th) => th.attributes('scope'))).toEqual([
      'col',
      'col',
      'col',
    ])
    const rowHeader = wrapper.find('tbody th')
    expect(rowHeader.attributes('scope')).toBe('row')
    expect(rowHeader.text()).toBe('Aktiv')
  })

  it('names every checkbox after its state and organisation', () => {
    const wrapper = mount(PermissionGrid, {
      props: { orgs, states, modelValue: [] },
      global: { plugins: [PrimeVue] },
    })
    const checkboxes = wrapper.findAllComponents({ name: 'Checkbox' })

    expect(checkboxes.map((c) => c.find('input').attributes('aria-label'))).toEqual([
      'Aktiv, Wien',
      'Aktiv, Neustadt',
    ])
  })

  it('adds and removes a permission value in the model when a checkbox is toggled in edit mode', async () => {
    const wrapper = mount(PermissionGrid, {
      props: { orgs, states, modelValue: [], edit: true },
      global: { plugins: [PrimeVue] },
    })

    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(true)

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['vbn_active']])
  })
})
