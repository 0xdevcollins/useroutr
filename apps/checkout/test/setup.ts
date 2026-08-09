import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom implements neither, and both are reached during render: Radix and
// framer-motion query `matchMedia`, and the countdown/progress components sit
// inside scroll containers that observe resize.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
