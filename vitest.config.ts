import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      // Vitest turns stylesheets into empty text unless they are listed here;
      // the dark mode token guard reads the raw text of the global stylesheet.
      css: { include: [/\/assets\/main\.css/] },
      exclude: [...configDefaults.exclude, 'e2e/*'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      setupFiles: ['./vitest.setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        include: [
          'src/components/**',
          'src/views/**',
          'src/stores/**',
          'src/composables/**',
          'src/services/**',
          'src/utils/**',
          'src/runtimeConfig.ts',
        ],
        thresholds: {
          // Everything outside the stores: statements, branches, functions and
          // lines must each stay at or above 90 %.
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,

          // Core logic (stores) is measured on its own and held to the same bar
          'src/stores/**': {
            statements: 90,
            branches: 90,
            functions: 90,
            lines: 90,
          },
        },
      },
    },
  }),
)
