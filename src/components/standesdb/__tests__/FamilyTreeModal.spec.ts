import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FamilyTreeModal from '../FamilyTreeModal.vue'
import PrimeVue from 'primevue/config'
import type { TreeNode } from '@/types/standesdb'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

function buildNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: 1,
    cn: 'Max Mustermann',
    gruender: false,
    org_id: 'vbw',
    state_id: 'active',
    entlassen: false,
    verstorben: false,
    children: [],
    ...overrides,
  }
}

const mountOpts = { global: { plugins: [PrimeVue] }, attachTo: document.body }

describe('FamilyTreeModal', () => {
  it('shows the ancestry chain and the current member', async () => {
    const ancestry = [buildNode({ id: 1, cn: 'Großvater' }), buildNode({ id: 2, cn: 'Vater' })]
    const wrapper = mount(FamilyTreeModal, {
      props: { visible: true, ancestry, children: [], memberId: 2 },
      ...mountOpts,
    })
    await wrapper.vm.$nextTick()

    expect(document.querySelector('.family-tree')?.textContent).toContain('Großvater')
    expect(document.querySelector('.family-tree')?.textContent).toContain('Vater')
    const current = Array.from(document.querySelectorAll('.tree-name')).find((el) =>
      el.classList.contains('tree-node-current'),
    )
    expect(current?.textContent?.trim()).toBe('Vater')
    wrapper.unmount()
  })

  it('does not show a caret for the current member itself', async () => {
    const ancestry = [buildNode({ id: 1, cn: 'Großvater' }), buildNode({ id: 2, cn: 'Ich' })]
    const wrapper = mount(FamilyTreeModal, {
      props: { visible: true, ancestry, children: [], memberId: 2 },
      ...mountOpts,
    })
    await wrapper.vm.$nextTick()

    const rows = document.querySelectorAll('.tree-row')
    expect(rows[1]!.querySelector('.tree-caret')).toBeNull()
    wrapper.unmount()
  })

  it('auto-collapses children that have their own children when opened', async () => {
    const children = [
      buildNode({ id: 3, cn: 'Sohn', children: [buildNode({ id: 4, cn: 'Enkel' })] }),
    ]
    const wrapper = mount(FamilyTreeModal, {
      props: { visible: false, ancestry: [], children, memberId: 1 },
      ...mountOpts,
    })
    await wrapper.setProps({ visible: true })
    await wrapper.vm.$nextTick()

    expect(document.querySelector('.family-tree')?.textContent).not.toContain('Enkel')
    wrapper.unmount()
  })

  it('toggles a collapsed ancestor and hides the deeper ancestry rows', async () => {
    const ancestry = [buildNode({ id: 1, cn: 'Großvater' }), buildNode({ id: 2, cn: 'Vater' })]
    const wrapper = mount(FamilyTreeModal, {
      props: { visible: true, ancestry, children: [], memberId: 2 },
      ...mountOpts,
    })
    await wrapper.vm.$nextTick()

    const caret = document.querySelector('.tree-caret') as HTMLElement
    caret.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(document.querySelector('.family-tree')?.textContent).not.toContain('Vater')
    wrapper.unmount()
  })

  it('navigates to the clicked member and closes the dialog', async () => {
    const ancestry = [buildNode({ id: 1, cn: 'Großvater' })]
    const wrapper = mount(FamilyTreeModal, {
      props: { visible: true, ancestry, children: [], memberId: 1 },
      ...mountOpts,
    })
    await wrapper.vm.$nextTick()

    const name = document.querySelector('.tree-name') as HTMLElement
    name.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(mockPush).toHaveBeenCalledWith({ name: 'standesdb-member-show', params: { id: 1 } })
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
    wrapper.unmount()
  })

  it('marks deceased or dismissed ancestors with the inactive class', async () => {
    const ancestry = [buildNode({ id: 1, cn: 'Verstorben', verstorben: true })]
    const wrapper = mount(FamilyTreeModal, {
      props: { visible: true, ancestry, children: [], memberId: 99 },
      ...mountOpts,
    })
    await wrapper.vm.$nextTick()

    expect(document.querySelector('.tree-name.tree-node-inactive')).not.toBeNull()
    wrapper.unmount()
  })

  it('renders a TreeBranch for each child', async () => {
    const children = [buildNode({ id: 5, cn: 'Kind A' }), buildNode({ id: 6, cn: 'Kind B' })]
    const wrapper = mount(FamilyTreeModal, {
      props: { visible: true, ancestry: [], children, memberId: 1 },
      ...mountOpts,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAllComponents({ name: 'TreeBranch' })).toHaveLength(2)
    wrapper.unmount()
  })

  it('forwards the dialog visibility update event', async () => {
    const wrapper = mount(FamilyTreeModal, {
      props: { visible: true, ancestry: [], children: [], memberId: 1 },
      ...mountOpts,
    })
    await wrapper.vm.$nextTick()

    await wrapper.findComponent({ name: 'Dialog' }).vm.$emit('update:visible', false)

    expect(wrapper.emitted('update:visible')).toEqual([[false]])
    wrapper.unmount()
  })
})
