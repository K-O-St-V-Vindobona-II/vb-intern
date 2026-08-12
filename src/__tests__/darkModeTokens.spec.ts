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
// reintroduces a raw --p-surface-N reference anywhere in the app.
const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW_TOKEN_PATTERN = /var\(--p-surface-\d+\)/

function collectVueFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      return collectVueFiles(fullPath)
    }
    return entry.endsWith('.vue') ? [fullPath] : []
  })
}

describe('dark mode token usage', () => {
  it('never references a raw (non-scheme-aware) --p-surface-N token', () => {
    const offenders = collectVueFiles(SRC_DIR)
      .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => RAW_TOKEN_PATTERN.test(content))
      .map(({ file }) => file.replace(SRC_DIR, 'src'))

    expect(offenders).toEqual([])
  })
})
