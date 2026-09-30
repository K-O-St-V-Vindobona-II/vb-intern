export interface LinkInsertionResult {
  text: string
  cursor: number
}

function stripClosingBrackets(value: string): string {
  return value.replace(/\]/g, '')
}

/**
 * Wraps the currently selected text (or, if nothing is selected, the URL
 * itself) in this feature's `[label](url)` mini-syntax and splices it into
 * `text` at the given selection — the building block behind
 * LinkInsertTextarea.vue's "Link einfügen" button. Kept as a plain,
 * DOM-free function so it's directly unit-testable.
 */
export function insertLink(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  url: string,
): LinkInsertionResult {
  const selectedText = text.slice(selectionStart, selectionEnd)
  // A `]` would end the label group of the `[label](url)` syntax early (the
  // public site's parser and the backend validator both match the label as
  // `[^\]]+`). The syntax has no escape mechanism, so a stray `]` is stripped;
  // a label that is empty afterwards falls back to the url.
  const label = stripClosingBrackets(selectedText) || stripClosingBrackets(url)
  // A `)` in the url would end the url group early (`[^)]+`). Percent-encoding
  // it keeps real addresses such as `.../Example_(disambiguation)` working.
  const safeUrl = url.replace(/\)/g, '%29')
  const markdown = `[${label}](${safeUrl})`

  return {
    text: text.slice(0, selectionStart) + markdown + text.slice(selectionEnd),
    cursor: selectionStart + markdown.length,
  }
}
