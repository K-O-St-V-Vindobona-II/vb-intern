import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Regression guard for a production incident (reported 2026-08-12): PrimeVue
// automatically follows the OS/browser color-scheme preference, but its raw
// --p-surface-N palette tokens do NOT change between light and dark mode -
// only the *semantic* tokens (e.g. --p-content-background, --p-text-color)
// do. Custom component styles that used --p-surface-N directly ended up
// with fixed-white backgrounds paired with dark-mode-white inherited text,
// i.e. invisible white-on-white form fields. The fix aliases the correct
// semantic tokens as --app-surface-card / --app-surface-subtle /
// --app-border-card in assets/main.css - this test fails if anyone
// reintroduces a raw --p-surface-N reference anywhere in the app - in a
// component (.vue) or in a global stylesheet (.css), with or without a
// fallback value inside var().
const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW_TOKEN_PATTERN = /var\(--p-surface-\d+/
const SCANNED_EXTENSIONS = ['.vue', '.css']

function collectStyledFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      return collectStyledFiles(fullPath)
    }
    return SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext)) ? [fullPath] : []
  })
}

describe('dark mode token usage', () => {
  it('never references a raw (non-scheme-aware) --p-surface-N token', () => {
    const offenders = collectStyledFiles(SRC_DIR)
      .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => RAW_TOKEN_PATTERN.test(content))
      .map(({ file }) => file.replace(SRC_DIR, 'src'))

    expect(offenders).toEqual([])
  })

  it('flags the fallback form var(--p-surface-N, ...) but not the scheme-aware aliases or comments', () => {
    expect(RAW_TOKEN_PATTERN.test('background: var(--p-surface-0, #fff);')).toBe(true)
    expect(RAW_TOKEN_PATTERN.test('background: var(--p-surface-100);')).toBe(true)
    expect(RAW_TOKEN_PATTERN.test('background: var(--app-surface-card);')).toBe(false)
    expect(RAW_TOKEN_PATTERN.test('/* was: --p-surface-0 */')).toBe(false)
  })
})
