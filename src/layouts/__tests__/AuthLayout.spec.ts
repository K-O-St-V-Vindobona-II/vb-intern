import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AuthLayout from '@/layouts/AuthLayout.vue'
import source from '../AuthLayout.vue?raw'

vi.mock('vue-router', () => ({
  RouterView: { template: '<div data-test="router-view" />' },
}))

const styleBlock = /<style>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? ''
const selectors = [...styleBlock.matchAll(/([^{}]+)\{/g)].map((match) => match[1]!.trim())

describe('AuthLayout.vue', () => {
  it('renders only the routed view', () => {
    const wrapper = mount(AuthLayout)

    expect(wrapper.find('[data-test="router-view"]').exists()).toBe(true)
  })

  // This stylesheet is deliberately unscoped and therefore lands in the
  // app-wide bundle: an un-nested helper class such as .text-center would
  // restyle every element with that class in the authenticated app too.
  it('nests every helper class under .auth-wrapper so it cannot leak into the app', () => {
    const leaking = selectors.filter(
      (selector) =>
        selector !== '.auth-wrapper' &&
        selector !== '.auth-card' &&
        !selector.startsWith('.auth-wrapper '),
    )

    expect(selectors.length).toBeGreaterThan(0)
    expect(leaking).toEqual([])
  })

  it('does not use :deep(), which is only meaningful in scoped styles and yields an invalid rule here', () => {
    expect(styleBlock).not.toContain(':deep(')
  })
})
