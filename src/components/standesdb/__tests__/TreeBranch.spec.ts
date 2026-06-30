import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TreeBranch from '../TreeBranch.vue'
import type { TreeNode } from '@/types/standesdb'

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

const mountWith = (props: Record<string, unknown>) => mount(TreeBranch, { props })

describe('TreeBranch', () => {
  it('shows a spacer instead of a caret for a leaf node', () => {
    const wrapper = mountWith({ node: buildNode(), depth: 0, collapsed: {}, memberId: 1 })
    expect(wrapper.find('.tree-caret-spacer').exists()).toBe(true)
  })

  it('shows a caret for a node with children', () => {
    // The child node itself has no children, so only the root row's own
    // markers must be checked - the child recursively renders its own spacer.
    const node = buildNode({ children: [buildNode({ id: 2, cn: 'Kind' })] })
    const wrapper = mountWith({ node, depth: 0, collapsed: {}, memberId: 1 })
    const rootRow = wrapper.find('.tree-row')
    expect(rootRow.find('.tree-caret-spacer').exists()).toBe(false)
    expect(rootRow.find('.tree-caret').exists()).toBe(true)
  })

  it('emits toggle with the node id when the caret is clicked', async () => {
    const node = buildNode({ id: 5, children: [buildNode({ id: 2, cn: 'Kind' })] })
    const wrapper = mountWith({ node, depth: 0, collapsed: {}, memberId: 1 })

    await wrapper.find('.tree-caret').trigger('click')

    expect(wrapper.emitted('toggle')).toEqual([[5]])
  })

  it('emits navigate with the node id when the name is clicked', async () => {
    const wrapper = mountWith({ node: buildNode({ id: 7 }), depth: 0, collapsed: {}, memberId: 1 })

    await wrapper.find('.tree-name').trigger('click')

    expect(wrapper.emitted('navigate')).toEqual([[7]])
  })

  it('recursively renders children when not collapsed', () => {
    const node = buildNode({
      id: 1,
      cn: 'Eltern',
      children: [buildNode({ id: 2, cn: 'Kind A' }), buildNode({ id: 3, cn: 'Kind B' })],
    })
    const wrapper = mountWith({ node, depth: 0, collapsed: {}, memberId: 1 })

    expect(wrapper.text()).toContain('Kind A')
    expect(wrapper.text()).toContain('Kind B')
    expect(wrapper.findAll('.tree-row')).toHaveLength(3) // root + 2 children
  })

  it('hides children when the node is collapsed', () => {
    const node = buildNode({
      id: 1,
      cn: 'Eltern',
      children: [buildNode({ id: 2, cn: 'Kind A' })],
    })
    const wrapper = mountWith({ node, depth: 0, collapsed: { 1: true }, memberId: 1 })

    expect(wrapper.text()).not.toContain('Kind A')
  })

  it('marks deceased or dismissed members as inactive', () => {
    const wrapper = mountWith({
      node: buildNode({ verstorben: true }),
      depth: 0,
      collapsed: {},
      memberId: 1,
    })
    expect(wrapper.find('.tree-name').classes()).toContain('tree-node-inactive')
  })

  it('highlights the currently viewed member', () => {
    const wrapper = mountWith({ node: buildNode({ id: 9 }), depth: 0, collapsed: {}, memberId: 9 })
    expect(wrapper.find('.tree-name').classes()).toContain('tree-node-current')
  })

  it('indents rows according to their depth', () => {
    const wrapper = mountWith({ node: buildNode(), depth: 3, collapsed: {}, memberId: 1 })
    expect((wrapper.find('.tree-row').element as HTMLElement).style.paddingLeft).toBe('60px')
  })

  it('forwards toggle and navigate events emitted by a recursively rendered child', async () => {
    const node = buildNode({
      id: 1,
      cn: 'Eltern',
      children: [buildNode({ id: 2, cn: 'Kind', children: [buildNode({ id: 3, cn: 'Enkel' })] })],
    })
    const wrapper = mountWith({ node, depth: 0, collapsed: {}, memberId: 1 })

    const childRow = wrapper.findAll('.tree-row')[1]!
    await childRow.find('.tree-caret').trigger('click')
    await childRow.find('.tree-name').trigger('click')

    expect(wrapper.emitted('toggle')).toEqual([[2]])
    expect(wrapper.emitted('navigate')).toEqual([[2]])
  })
})
