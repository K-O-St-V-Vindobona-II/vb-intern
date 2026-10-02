import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import LinkInsertTextarea from '../LinkInsertTextarea.vue'

describe('LinkInsertTextarea', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
  })

  async function openDialog(w: VueWrapper) {
    await w.find('button').trigger('click')
    await flushPromises()
  }

  function typeUrl(value: string) {
    const urlInput = document.querySelector<HTMLInputElement>('#link-insert-url')!
    urlInput.value = value
    urlInput.dispatchEvent(new Event('input'))
    return urlInput
  }

  function findButton(label: string) {
    return Array.from(document.querySelectorAll('button')).find((b) => b.textContent === label)
  }

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

  it('uses the URL itself as the label when nothing is selected', async () => {
    const w = mountComponent('Text')
    const textarea = w.find('textarea').element as HTMLTextAreaElement
    textarea.setSelectionRange(4, 4)
    await openDialog(w)

    typeUrl('https://example.com')
    findButton('Einfügen')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([
      'Text[https://example.com](https://example.com)',
    ])
  })

  it('confirms with the Enter key and trims surrounding whitespace', async () => {
    const w = mountComponent('Schau hier vorbei.')
    const textarea = w.find('textarea').element as HTMLTextAreaElement
    textarea.setSelectionRange(6, 10)
    await openDialog(w)

    const urlInput = typeUrl('  https://example.com  ')
    urlInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    await flushPromises()

    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([
      'Schau [hier](https://example.com) vorbei.',
    ])
  })

  it.each(['example.com', 'javascript:alert(1)', 'ftp://example.com', 'https://', 'https://a b'])(
    'rejects the address %j: shows the hint, disables the button and ignores Enter',
    async (invalid) => {
      const w = mountComponent('Text')
      await openDialog(w)

      const urlInput = typeUrl(invalid)
      await flushPromises()
      urlInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
      await flushPromises()

      expect(document.querySelector('#link-insert-url-error')?.textContent).toContain('https://')
      expect(document.querySelector('#link-insert-url-error')?.getAttribute('role')).toBe('alert')
      expect(urlInput.getAttribute('aria-describedby')).toBe('link-insert-url-error')
      expect(urlInput.getAttribute('aria-invalid')).toBe('true')
      expect(findButton('Einfügen')?.hasAttribute('disabled')).toBe(true)
      expect(w.emitted('update:modelValue')).toBeUndefined()
    },
  )

  it.each(['siehe https://example.com', 'xhttps://example.com'])(
    'rejects %j because the address does not start with the scheme',
    async (invalid) => {
      const w = mountComponent('Text')
      await openDialog(w)

      typeUrl(invalid)
      await flushPromises()

      expect(document.querySelector('#link-insert-url-error')).toBeTruthy()
      expect(findButton('Einfügen')?.hasAttribute('disabled')).toBe(true)
    },
  )

  it('accepts an upper-case scheme', async () => {
    const w = mountComponent('Text')
    await openDialog(w)

    typeUrl('HTTPS://Example.com')
    await flushPromises()

    expect(document.querySelector('#link-insert-url-error')).toBeFalsy()
    expect(findButton('Einfügen')?.hasAttribute('disabled')).toBe(false)
  })

  it('does not mark a valid address as invalid and clears the link to the hint', async () => {
    const w = mountComponent('Text')
    await openDialog(w)

    const urlInput = typeUrl('https://example.com')
    await flushPromises()

    expect(urlInput.getAttribute('aria-invalid')).not.toBe('true')
    expect(urlInput.hasAttribute('aria-describedby')).toBe(false)
  })

  it('shows no error hint while the field is still empty', async () => {
    const w = mountComponent('Text')
    await openDialog(w)

    expect(document.querySelector('#link-insert-url-error')).toBeFalsy()
  })

  it('puts the cursor behind the inserted link and returns focus to the textarea', async () => {
    const w = mountComponent('Schau hier vorbei.')
    // Emulates the parent's v-model: the textarea only holds the new text
    // (and can therefore take the cursor position) once the prop is updated.
    await w.setProps({
      'onUpdate:modelValue': (value: string) => w.setProps({ modelValue: value }),
    })
    const textarea = w.find('textarea').element as HTMLTextAreaElement
    textarea.setSelectionRange(6, 10)
    await openDialog(w)

    typeUrl('https://example.com')
    findButton('Einfügen')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    const inserted = '[hier](https://example.com)'
    expect(textarea.selectionStart).toBe(6 + inserted.length)
    expect(document.activeElement).toBe(textarea)
  })

  it('starts every dialog with an empty URL field', async () => {
    const w = mountComponent('Text')
    await openDialog(w)
    typeUrl('https://example.com')
    findButton('Abbrechen')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    await openDialog(w)

    expect(document.querySelector<HTMLInputElement>('#link-insert-url')?.value).toBe('')
  })
})
