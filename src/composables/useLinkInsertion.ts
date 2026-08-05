export interface LinkInsertionResult {
  text: string
  cursor: number
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
  const label = selectedText || url
  const markdown = `[${label}](${url})`

  return {
    text: text.slice(0, selectionStart) + markdown + text.slice(selectionEnd),
    cursor: selectionStart + markdown.length,
  }
}
