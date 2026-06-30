import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
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
        ],
        // Granular quality gates instead of a global threshold
        thresholds: {
          // Global baseline for all unmapped files
          statements: 70,
          branches: 65,
          functions: 70,
          lines: 70,

          // Core logic (stores/composables): strict coverage required
          'src/stores/**': {
            statements: 90,
            branches: 90,
            functions: 90,
            lines: 90,
          },

          // UI Components: focus on functional behavior (props/emits)
          'src/components/**': {
            statements: 75,
            branches: 70,
            functions: 75,
            lines: 75,
          },

          // Views (orchestration): lower threshold to prevent brittle DOM tests
          'src/views/**': {
            statements: 60,
            branches: 50,
            functions: 60,
            lines: 60,
          },
        },
      },
    },
  }),
)
