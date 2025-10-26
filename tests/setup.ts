// Polyfill for TextEncoder/TextDecoder in jsdom environment
// This must be done BEFORE any other imports to fix esbuild "Invariant violation" error
import { TextEncoder, TextDecoder } from 'util'

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as any
}

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { getContext } from '../src/state-utils/ctx'

// Cleanup after each test case
afterEach(() => {
  cleanup()
  getContext.cache.clear()
})
