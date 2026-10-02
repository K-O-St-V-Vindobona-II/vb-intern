import { describe, it, expect } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import DirPath from '../DirPath.vue'

function mountPath(path: { id: string; name: string }[]) {
  return mount(DirPath, {
    props: { path },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('DirPath', () => {
  it('always renders the root "Archiv" link', () => {
    const wrapper = mountPath([])
    expect(wrapper.text()).toContain('Archiv')
  })

  it('renders one link plus separator per path entry', () => {
    const wrapper = mountPath([
      { id: '1', name: 'Fotos' },
      { id: '2', name: '2026' },
    ])
    expect(wrapper.text()).toContain('Fotos')
    expect(wrapper.text()).toContain('2026')
    expect(wrapper.findAll('.path-sep')).toHaveLength(2)
  })

  it('links the root entry to archive-root', () => {
    const wrapper = mountPath([{ id: '1', name: 'Fotos' }])
    const links = wrapper.findAllComponents(RouterLinkStub)

    expect(links[0]!.props('to')).toEqual({ name: 'archive-root' })
  })

  it('links each path entry to archive-dir with its own id', () => {
    const wrapper = mountPath([
      { id: '1', name: 'Fotos' },
      { id: '2', name: '2026' },
    ])
    const links = wrapper.findAllComponents(RouterLinkStub)

    expect(links).toHaveLength(3)
    expect(links[1]!.props('to')).toEqual({ name: 'archive-dir', params: { id: '1' } })
    expect(links[2]!.props('to')).toEqual({ name: 'archive-dir', params: { id: '2' } })
  })

  it('is a labelled navigation landmark whose separators are hidden from assistive technology', () => {
    const wrapper = mountPath([{ id: '1', name: 'Fotos' }])

    expect(wrapper.element.tagName).toBe('NAV')
    expect(wrapper.attributes('aria-label')).toBe('Verzeichnispfad')
    expect(wrapper.find('.path-sep').attributes('aria-hidden')).toBe('true')
  })
})
