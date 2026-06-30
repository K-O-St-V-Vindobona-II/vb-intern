import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DirPath from '../DirPath.vue'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

describe('DirPath', () => {
  it('always renders the root "Archiv" link', () => {
    const wrapper = mount(DirPath, { props: { path: [] } })
    expect(wrapper.text()).toContain('Archiv')
  })

  it('renders one link plus separator per path entry', () => {
    const wrapper = mount(DirPath, {
      props: {
        path: [
          { id: 1, name: 'Fotos' },
          { id: 2, name: '2026' },
        ],
      },
    })
    expect(wrapper.text()).toContain('Fotos')
    expect(wrapper.text()).toContain('2026')
    expect(wrapper.findAll('.path-sep')).toHaveLength(2)
  })

  it('navigates to archive-root when the root link is clicked', async () => {
    const wrapper = mount(DirPath, { props: { path: [{ id: 1, name: 'Fotos' }] } })
    await wrapper.findAll('.path-link')[0]!.trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'archive-root' })
  })

  it('navigates to archive-dir with the entry id when a path entry is clicked', async () => {
    const wrapper = mount(DirPath, {
      props: {
        path: [
          { id: 1, name: 'Fotos' },
          { id: 2, name: '2026' },
        ],
      },
    })
    await wrapper.findAll('.path-link')[2]!.trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'archive-dir', params: { id: 2 } })
  })
})
