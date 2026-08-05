import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import LinkInsertTextarea from '../LinkInsertTextarea.vue'

describe('LinkInsertTextarea', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
  })

  function mountComponent(modelValue = 'Schau hier vorbei.') {
    wrapper = mount(LinkInsertTextarea, {
      props: { modelValue },
      global: { plugins: [PrimeVue] },
      attachTo: document.body,
    })
    return wrapper
  }

  it('renders the current text in the textarea', () => {
    const w = mountComponent('Hallo Welt')
    const textarea = w.find('textarea')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('Hallo Welt')
  })

  it('emits update:modelValue when typed into', async () => {
    const w = mountComponent('')
    const textarea = w.find('textarea')
    await textarea.setValue('Neuer Text')

    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['Neuer Text'])
  })

  it('wraps the current selection in [label](url) on confirm', async () => {
    const w = mountComponent('Schau hier vorbei.')
    const textarea = w.find('textarea').element as HTMLTextAreaElement
    textarea.setSelectionRange(6, 10) // selects "hier"

    await w.find('button').trigger('click') // opens the "Link einfügen" dialog
    await flushPromises()

    const urlInput = document.querySelector<HTMLInputElement>('#link-insert-url')
    expect(urlInput).toBeTruthy()
    urlInput!.value = 'https://example.com'
    urlInput!.dispatchEvent(new Event('input'))

    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Einfügen',
    )
    confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([
      'Schau [hier](https://example.com) vorbei.',
    ])
  })

  it('does not emit when confirming without a URL', async () => {
    const w = mountComponent('Text')
    await w.find('button').trigger('click')
    await flushPromises()

    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Einfügen',
    )
    expect(confirmButton?.hasAttribute('disabled')).toBe(true)

    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('closes the dialog on cancel without emitting', async () => {
    const w = mountComponent('Text')
    await w.find('button').trigger('click')
    await flushPromises()

    const urlInput = document.querySelector<HTMLInputElement>('#link-insert-url')
    urlInput!.value = 'https://example.com'
    urlInput!.dispatchEvent(new Event('input'))

    const cancelButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Abbrechen',
    )
    cancelButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(document.querySelector('#link-insert-url')).toBeFalsy()
  })
})
