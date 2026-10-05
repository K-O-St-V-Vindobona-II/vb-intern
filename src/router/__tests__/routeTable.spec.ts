import { describe, it, expect } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import router from '@/router'

describe('route table', () => {
  it('has no two pages with the same path, because the first one shadows the second', () => {
    // A layout and its home page legitimately share "/"; only records without children are pages.
    const paths = router
      .getRoutes()
      .filter((route) => route.children.length === 0)
      .map((route) => route.path)

    const duplicates = paths.filter((path, index) => paths.indexOf(path) !== index)

    expect(duplicates).toEqual([])
  })

  it('has no two routes with the same name', () => {
    // The router replaces an earlier route of the same name when a later one is added, so
    // getRoutes() never shows a duplicate; the declared table does.
    const declaredNames = (routes: readonly RouteRecordRaw[]): string[] =>
      routes.flatMap((route) => [
        ...(typeof route.name === 'string' ? [route.name] : []),
        ...declaredNames(route.children ?? []),
      ])
    const names = declaredNames(router.options.routes)

    const duplicates = names.filter((name, index) => names.indexOf(name) !== index)

    expect(duplicates).toEqual([])
  })

  it('serves the archive at /archive and has no placeholder page for it or for /information', () => {
    expect(router.resolve('/archive').name).toBe('archive-root')
    expect(router.hasRoute('archive')).toBe(false)
    expect(router.resolve('/information').name).toBe('not-found')
  })
})
