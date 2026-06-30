import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PermissionViewer from '../PermissionViewer.vue'
import PrimeVue from 'primevue/config'

const orgs = [{ id: 'vbw', label: 'Wien' }]
const states = [{ id: 'active', label: 'Aktiv' }]

const mountWith = (props: Record<string, unknown>) =>
  mount(PermissionViewer, {
    props: { orgs, states, modelValue: [], ...props },
    global: { plugins: [PrimeVue] },
  })

describe('PermissionViewer', () => {
  it('renders the title', () => {
    const wrapper = mountWith({ title: 'Eigene Berechtigungen' })
    expect(wrapper.text()).toContain('Eigene Berechtigungen')
  })

  it('is collapsed by default and hides the permission grid', () => {
    const wrapper = mountWith({ title: 'Berechtigungen' })
    expect(wrapper.findComponent({ name: 'PermissionGrid' }).exists()).toBe(false)
    expect(wrapper.find('.pi-chevron-right').exists()).toBe(true)
  })

  it('expands and shows the permission grid when the header is clicked', async () => {
    const wrapper = mountWith({ title: 'Berechtigungen' })
    await wrapper.find('.perm-header').trigger('click')

    expect(wrapper.findComponent({ name: 'PermissionGrid' }).exists()).toBe(true)
    expect(wrapper.find('.pi-chevron-down').exists()).toBe(true)
  })

  it('collapses again on a second click', async () => {
    const wrapper = mountWith({ title: 'Berechtigungen' })
    await wrapper.find('.perm-header').trigger('click')
    await wrapper.find('.perm-header').trigger('click')

    expect(wrapper.findComponent({ name: 'PermissionGrid' }).exists()).toBe(false)
  })

  it('shows the recursive badge when recursive is true', () => {
    const wrapper = mountWith({ title: 'Berechtigungen', recursive: true })
    expect(wrapper.text()).toContain('[rekursiv]')
  })

  it('hides the recursive badge by default', () => {
    const wrapper = mountWith({ title: 'Berechtigungen' })
    expect(wrapper.find('.recursive-badge').exists()).toBe(false)
  })
})
