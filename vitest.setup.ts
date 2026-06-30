import { vi } from 'vitest'

// jsdom does not implement matchMedia, but several PrimeVue components
// (e.g. Select) query it unconditionally on mount for orientation handling.
vi.stubGlobal(
  'matchMedia',
  vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
)
