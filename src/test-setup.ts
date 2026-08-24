import '@testing-library/jest-dom/vitest'

import { vi } from 'vitest'

// jsdom doesn't implement the Geolocation API. Stub it with harmless no-ops
// so components/hooks that call navigator.geolocation.* don't crash in tests
// that aren't specifically exercising geolocation; those tests override this
// with their own mock via Object.defineProperty.
Object.defineProperty(globalThis.navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(() => 0),
    clearWatch: vi.fn(),
  },
  configurable: true,
})

// jsdom doesn't implement ResizeObserver either. A no-op stub is enough for
// components that only use it to trigger a side effect (e.g. Leaflet's
// invalidateSize) — no test here asserts on an actual resize firing.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
