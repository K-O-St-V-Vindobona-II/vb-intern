import { describe, it, expect } from 'vitest'
import conf from '../../nginx.conf?raw'

const directives = conf
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#'))

// The file is checked as text: the directives below were verified against a running nginx
// (headers and status codes of the probes), this spec keeps them from being edited away.
describe('nginx.conf', () => {
  it('does not announce the nginx version', () => {
    expect(directives).toContain('server_tokens off;')
  })

  it('serves the start page for a client-side route (the router needs it)', () => {
    expect(directives).toContain('try_files $uri $uri/ /index.html;')
  })

  it('sends exactly one Cache-Control header for the hashed assets, without "expires"', () => {
    const assets = conf.slice(conf.indexOf('location /assets/'))
    const block = assets.slice(0, assets.indexOf('}'))

    expect(block.match(/Cache-Control/g)).toHaveLength(1)
    expect(block).toContain('"public, max-age=31536000, immutable"')
    expect(block).not.toContain('expires')
  })

  it('revalidates the start page and never caches the runtime config', () => {
    expect(conf).toMatch(/location = \/index\.html \{\s+add_header Cache-Control "no-cache";/)
    expect(conf).toMatch(/location = \/config\.js \{[^}]*add_header Cache-Control "no-store";/)
  })
})
