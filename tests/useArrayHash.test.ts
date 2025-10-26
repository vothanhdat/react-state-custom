import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useArrayHash } from '../src/state-utils/useArrayHash'

describe('useArrayHash', () => {
  it('should return a hash for an array', () => {
    const { result } = renderHook(() => useArrayHash([1, 2, 3]))
    
    expect(typeof result.current).toBe('string')
    expect(result.current.length).toBeGreaterThan(0)
  })

  it('should return same hash for unchanged array reference', () => {
    const arr = [1, 2, 3]
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayHash(arr),
      { initialProps: { arr } }
    )

    const hash1 = result.current

    // Rerender with same array VALUES (not reference) - should keep same hash
    rerender({ arr: [1, 2, 3] })

    const hash2 = result.current

    expect(hash1).toBe(hash2)
  })

  it('should return different hash when array changes', () => {
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayHash(arr),
      { initialProps: { arr: [1, 2, 3] } }
    )

    const hash1 = result.current

    rerender({ arr: [1, 2, 4] })

    const hash2 = result.current

    expect(hash1).not.toBe(hash2)
  })

  it('should detect length changes', () => {
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayHash(arr),
      { initialProps: { arr: [1, 2, 3] } }
    )

    const hash1 = result.current

    rerender({ arr: [1, 2, 3, 4] })

    const hash2 = result.current

    expect(hash1).not.toBe(hash2)
  })

  it('should detect element changes at any position', () => {
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayHash(arr),
      { initialProps: { arr: ['a', 'b', 'c'] } }
    )

    const hash1 = result.current

    // Change first element
    rerender({ arr: ['x', 'b', 'c'] })
    const hash2 = result.current
    expect(hash1).not.toBe(hash2)

    // Change middle element
    rerender({ arr: ['a', 'x', 'c'] })
    const hash3 = result.current
    expect(hash2).not.toBe(hash3)

    // Change last element
    rerender({ arr: ['a', 'b', 'x'] })
    const hash4 = result.current
    expect(hash3).not.toBe(hash4)
  })

  it('should handle empty arrays', () => {
    const { result } = renderHook(() => useArrayHash([]))
    
    expect(typeof result.current).toBe('string')
  })

  it('should handle arrays with objects', () => {
    const obj1 = { id: 1 }
    const obj2 = { id: 2 }

    const { result, rerender } = renderHook(
      ({ arr }) => useArrayHash(arr),
      { initialProps: { arr: [obj1, obj2] } }
    )

    const hash1 = result.current

    // Same references, same hash
    rerender({ arr: [obj1, obj2] })
    expect(result.current).toBe(hash1)

    // Different reference objects, different hash
    rerender({ arr: [{ id: 1 }, { id: 2 }] })
    expect(result.current).not.toBe(hash1)
  })

  it('should handle arrays with nested arrays', () => {
    const nested1 = [1, 2]
    const nested2 = [3, 4]

    const { result, rerender } = renderHook(
      ({ arr }) => useArrayHash(arr),
      { initialProps: { arr: [nested1, nested2] } }
    )

    const hash1 = result.current

    // Same references
    rerender({ arr: [nested1, nested2] })
    expect(result.current).toBe(hash1)

    // Different references
    rerender({ arr: [[1, 2], [3, 4]] })
    expect(result.current).not.toBe(hash1)
  })

  it('should handle mixed types', () => {
    const obj1 = { key: 'value' }
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayHash(arr),
      { initialProps: { arr: [1, 'string', true, null, undefined, obj1] } }
    )

    const hash1 = result.current

    // Same references
    rerender({ arr: [1, 'string', true, null, undefined, obj1] })
    expect(result.current).toBe(hash1)

    // Different object reference should result in different hash
    rerender({ arr: [1, 'string', true, null, undefined, { key: 'value' }] })
    expect(result.current).not.toBe(hash1)
  })

  it('should be stable across multiple re-renders with same array values', () => {
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayHash(arr),
      { initialProps: { arr: [1, 2, 3] } }
    )

    const hash = result.current

    // Multiple re-renders with same values
    for (let i = 0; i < 10; i++) {
      rerender({ arr: [1, 2, 3] })
      expect(result.current).toBe(hash)
    }
  })

  it('should handle large arrays', () => {
    const largeArray = Array.from({ length: 1000 }, (_, i) => i)
    
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayHash(arr),
      { initialProps: { arr: largeArray } }
    )

    const hash1 = result.current

    // Change one element in the middle
    const modifiedArray = [...largeArray]
    modifiedArray[500] = -1

    rerender({ arr: modifiedArray })

    expect(result.current).not.toBe(hash1)
  })
})
