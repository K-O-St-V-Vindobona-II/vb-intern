import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CategoryLabel from '../CategoryLabel.vue'
import type { P4xCategory } from '@/types/p4x'

function buildCategory(overrides: Partial<P4xCategory> = {}): P4xCategory {
  return {
    id: 'category-uuid-1',
    name: 'spende',
    label: 'Spende',
    background_color: '#fff',
    text_color: '#000',
    protected: false,
    ...overrides,
  }
}

describe('CategoryLabel', () => {
  it('renders nothing when no category is given', () => {
    const wrapper = mount(CategoryLabel, { props: { category: undefined } })
    expect(wrapper.find('.category-badge').exists()).toBe(false)
  })

  it('renders the category label with its colors', () => {
    const wrapper = mount(CategoryLabel, { props: { category: buildCategory() } })
    expect(wrapper.text()).toContain('Spende')
    const badge = wrapper.find('.category-badge')
    expect(badge.attributes('style')).toContain('background-color: rgb(255, 255, 255)')
  })

  it('shows a filter icon by default and a check icon when direct', () => {
    const filtered = mount(CategoryLabel, { props: { category: buildCategory() } })
    expect(filtered.find('.pi-filter').exists()).toBe(true)
    expect(filtered.find('.pi-check').exists()).toBe(false)

    const direct = mount(CategoryLabel, { props: { category: buildCategory(), direct: true } })
    expect(direct.find('.pi-check').exists()).toBe(true)
    expect(direct.find('.pi-filter').exists()).toBe(false)
  })

  it('shows the formatted amount when given', () => {
    const wrapper = mount(CategoryLabel, { props: { category: buildCategory(), amount: 5 } })
    expect(wrapper.text()).toContain('5,00')
  })

  it('does not show an amount when null', () => {
    const wrapper = mount(CategoryLabel, { props: { category: buildCategory(), amount: null } })
    expect(wrapper.text()).not.toContain('€')
  })

  it('shows the text colour of the category', () => {
    const wrapper = mount(CategoryLabel, {
      props: { category: buildCategory({ text_color: '#123456', background_color: '#abcdef' }) },
    })

    const style = wrapper.find('.category-badge').attributes('style')
    expect(style).toContain('color: rgb(18, 52, 86)')
    expect(style).toContain('background-color: rgb(171, 205, 239)')
  })

  it('says in words whether the category was assigned directly or by a filter', () => {
    const filtered = mount(CategoryLabel, { props: { category: buildCategory() } })
    const direct = mount(CategoryLabel, { props: { category: buildCategory(), direct: true } })

    expect(filtered.find('.visually-hidden').text()).toBe('Über Filter zugewiesen:')
    expect(direct.find('.visually-hidden').text()).toBe('Direkt zugewiesen:')
    expect(filtered.findAll('i').every((i) => i.attributes('aria-hidden') === 'true')).toBe(true)
    expect(direct.findAll('i').every((i) => i.attributes('aria-hidden') === 'true')).toBe(true)
    expect(direct.findAll('i')).toHaveLength(1)
  })

  it('does not construct a number formatter per render', () => {
    const constructed = vi.spyOn(Intl, 'NumberFormat')

    for (let i = 0; i < 20; i++) {
      mount(CategoryLabel, { props: { category: buildCategory(), amount: i } })
    }

    expect(constructed).not.toHaveBeenCalled()
    constructed.mockRestore()
  })
})
