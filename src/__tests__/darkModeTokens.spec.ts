import { describe, it, expect } from 'vitest'

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
const RAW_TOKEN_PATTERN = /var\(--p-surface-\d+/

// Raw text of every component and global stylesheet, keyed by its path from
// the project root (for example "/src/assets/main.css").
const styledSources = import.meta.glob<string>(['/src/**/*.vue', '/src/**/*.css'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('dark mode token usage', () => {
  it('reads the text of the global stylesheet and of the components', () => {
    expect(styledSources['/src/assets/main.css']).toContain('--app-surface-card')
    expect(styledSources['/src/App.vue']).toContain('<template>')
  })

  it('never references a raw (non-scheme-aware) --p-surface-N token', () => {
    const offenders = Object.entries(styledSources)
      .filter(([, content]) => RAW_TOKEN_PATTERN.test(content))
      .map(([path]) => path.replace(/^\//, ''))

    expect(offenders).toEqual([])
  })

  it('flags the fallback form var(--p-surface-N, ...) but not the scheme-aware aliases or comments', () => {
    expect(RAW_TOKEN_PATTERN.test('background: var(--p-surface-0, #fff);')).toBe(true)
    expect(RAW_TOKEN_PATTERN.test('background: var(--p-surface-100);')).toBe(true)
    expect(RAW_TOKEN_PATTERN.test('background: var(--app-surface-card);')).toBe(false)
    expect(RAW_TOKEN_PATTERN.test('/* was: --p-surface-0 */')).toBe(false)
  })
})
