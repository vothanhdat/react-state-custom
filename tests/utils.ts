import { act } from '@testing-library/react'
import { vi } from 'vitest'

/**
 * Helper to wrap async operations in act()
 */
export const actAsync = async (fn: () => Promise<void>) => {
  await act(async () => {
    await fn()
  })
}

/**
 * Helper to run async code with real timers temporarily
 * Useful when fake timers are active but async operations need to complete
 */
export const withRealTimers = async <T>(fn: () => Promise<T>): Promise<T> => {
  vi.useRealTimers()
  try {
    return await fn()
  } finally {
    vi.useFakeTimers()
  }
}

/**
 * Helper to wait for a specific condition with timeout
 */
export const waitForCondition = (
  condition: () => boolean,
  timeout = 1000,
  interval = 50
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    const checkCondition = () => {
      if (condition()) {
        resolve()
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'))
      } else {
        setTimeout(checkCondition, interval)
      }
    }
    
    checkCondition()
  })
}

/**
 * Helper to create a spy that tracks all calls
 */
export const createSpy = <T extends (...args: any[]) => any>() => {
  const calls: Parameters<T>[] = []
  const spy = ((...args: Parameters<T>) => {
    calls.push(args)
  }) as T & { calls: Parameters<T>[] }
  spy.calls = calls
  return spy
}
