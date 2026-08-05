import { describe, it, expect } from 'vitest'
import { insertLink } from '@/composables/useLinkInsertion'

describe('insertLink', () => {
  it('wraps the selected text as the link label', () => {
    const result = insertLink('Schau hier vorbei.', 6, 10, 'https://example.com')

    expect(result.text).toBe('Schau [hier](https://example.com) vorbei.')
  })

  it('uses the URL itself as the label when nothing is selected', () => {
    const result = insertLink('Schau  vorbei.', 6, 6, 'https://example.com')

    expect(result.text).toBe('Schau [https://example.com](https://example.com) vorbei.')
  })

  it('places the cursor right after the inserted link', () => {
    const result = insertLink('Schau hier vorbei.', 6, 10, 'https://example.com')

    expect(result.text.slice(0, result.cursor)).toBe('Schau [hier](https://example.com)')
  })

  it('inserts at the very start of an empty text', () => {
    const result = insertLink('', 0, 0, 'https://example.com')

    expect(result.text).toBe('[https://example.com](https://example.com)')
    expect(result.cursor).toBe(result.text.length)
  })

  it('replaces the full text when everything is selected', () => {
    const result = insertLink('altertext', 0, 9, 'https://example.com')

    expect(result.text).toBe('[altertext](https://example.com)')
  })
})
