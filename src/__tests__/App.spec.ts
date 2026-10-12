import { describe, it, expect, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Toast from 'primevue/toast'
import App from '@/App.vue'

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function mountApp(): VueWrapper {
  wrapper = mount(App, {
    attachTo: document.body,
    global: {
      plugins: [PrimeVue, ToastService, ConfirmationService],
      stubs: { RouterView: true, ConsoleBanner: true },
    },
  })
  return wrapper
}

describe('App', () => {
  it('caps the toast width at the viewport so it never runs off a phone screen', async () => {
    mountApp()
    await flushPromises()

    // jsdom discards min()/calc() when it parses a style, so the rendered
    // width cannot be asserted; the value handed to the component can.
    const toast = wrapper?.findComponent(Toast)

    expect(toast?.exists()).toBe(true)
    // Mobile-first: the base width follows the viewport, 25rem is only the cap.
    expect(toast?.vm.$attrs.style).toEqual({ width: 'min(25rem, calc(100vw - 2.5rem))' })
  })

  it('keeps the toasts in the bottom left corner', async () => {
    mountApp()
    await flushPromises()

    expect(document.querySelector('.p-toast-bottom-left')).not.toBeNull()
  })
})
