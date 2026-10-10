import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import PermissionViewer from '../PermissionViewer.vue'
import PrimeVue from 'primevue/config'

const orgs = [{ id: 'vbw', label: 'Wien' }]
const states = [{ id: 'active', label: 'Aktiv' }]

const mountWith = (props: { title: string; recursive?: boolean }) =>
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

  it('renders the header as a real button that reports and controls its expanded state', async () => {
    const wrapper = mountWith({ title: 'Berechtigungen' })
    const header = wrapper.find('.perm-header')

    expect(header.element.tagName).toBe('BUTTON')
    expect(header.attributes('type')).toBe('button')
    expect(header.attributes('aria-expanded')).toBe('false')

    await header.trigger('click')

    expect(header.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find(`#${header.attributes('aria-controls')}`).exists()).toBe(true)
  })

  it('gives every instance in one app its own body id', () => {
    const wrapper = mount(
      {
        render: () => [
          h(PermissionViewer, { title: 'A', orgs, states, modelValue: [] }),
          h(PermissionViewer, { title: 'B', orgs, states, modelValue: [] }),
        ],
      },
      { global: { plugins: [PrimeVue] } },
    )
    const [first, second] = wrapper.findAll('.perm-header')

    expect(first!.attributes('aria-controls')).toBeTruthy()
    expect(first!.attributes('aria-controls')).not.toBe(second!.attributes('aria-controls'))
  })
})
