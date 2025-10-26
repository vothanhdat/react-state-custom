import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useArrayChangeId } from '../src/state-utils/useArrayChangeId'

describe('useArrayChangeId', () => {
  it('should return a change identifier for an array', () => {
    const { result } = renderHook(() => useArrayChangeId([1, 2, 3]))
    
    expect(typeof result.current).toBe('string')
    expect(result.current.length).toBeGreaterThan(0)
  })

  it('should return same identifier when array values are unchanged (shallow comparison)', () => {
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayChangeId(arr),
      { initialProps: { arr: [1, 2, 3] } }
    )

    const id1 = result.current

    // Rerender with new array but same primitive values - should keep same identifier
    // because shallow comparison checks length and element equality
    rerender({ arr: [1, 2, 3] })

    const id2 = result.current

    expect(id1).toBe(id2)
  })

  it('should return different identifier when array element values change', () => {
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayChangeId(arr),
      { initialProps: { arr: [1, 2, 3] } }
    )

    const id1 = result.current

    rerender({ arr: [1, 2, 4] })

    const id2 = result.current

    expect(id1).not.toBe(id2)
  })

  it('should detect length changes', () => {
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayChangeId(arr),
      { initialProps: { arr: [1, 2, 3] } }
    )

    const hash1 = result.current

    rerender({ arr: [1, 2, 3, 4] })

    const hash2 = result.current

    expect(hash1).not.toBe(hash2)
  })

  it('should detect element changes at any position', () => {
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayChangeId(arr),
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
    const { result } = renderHook(() => useArrayChangeId([]))
    
    expect(typeof result.current).toBe('string')
  })

  it('should handle arrays with objects (shallow comparison - by reference)', () => {
    const obj1 = { id: 1 }
    const obj2 = { id: 2 }

    const { result, rerender } = renderHook(
      ({ arr }) => useArrayChangeId(arr),
      { initialProps: { arr: [obj1, obj2] } }
    )

    const id1 = result.current

    // Same object references, same identifier
    rerender({ arr: [obj1, obj2] })
    expect(result.current).toBe(id1)

    // Different object references (even with same values), different identifier
    // This is shallow comparison - it compares references, not deep values
    rerender({ arr: [{ id: 1 }, { id: 2 }] })
    expect(result.current).not.toBe(id1)
  })

  it('should handle arrays with nested arrays (shallow comparison - by reference)', () => {
    const nested1 = [1, 2]
    const nested2 = [3, 4]

    const { result, rerender } = renderHook(
      ({ arr }) => useArrayChangeId(arr),
      { initialProps: { arr: [nested1, nested2] } }
    )

    const id1 = result.current

    // Same array references, same identifier
    rerender({ arr: [nested1, nested2] })
    expect(result.current).toBe(id1)

    // Different array references (even with same values), different identifier
    rerender({ arr: [[1, 2], [3, 4]] })
    expect(result.current).not.toBe(id1)
  })

  it('should handle mixed types with shallow comparison', () => {
    const obj1 = { key: 'value' }
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayChangeId(arr),
      { initialProps: { arr: [1, 'string', true, null, undefined, obj1] } }
    )

    const id1 = result.current

    // Same primitive values and same object reference, same identifier
    rerender({ arr: [1, 'string', true, null, undefined, obj1] })
    expect(result.current).toBe(id1)

    // Different object reference, different identifier
    rerender({ arr: [1, 'string', true, null, undefined, { key: 'value' }] })
    expect(result.current).not.toBe(id1)
  })

  it('should be stable across multiple re-renders with same primitive values', () => {
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayChangeId(arr),
      { initialProps: { arr: [1, 2, 3] } }
    )

    const id = result.current

    // Multiple re-renders with same primitive values should maintain same identifier
    for (let i = 0; i < 10; i++) {
      rerender({ arr: [1, 2, 3] })
      expect(result.current).toBe(id)
    }
  })

  it('should handle large arrays', () => {
    const largeArray = Array.from({ length: 1000 }, (_, i) => i)
    
    const { result, rerender } = renderHook(
      ({ arr }) => useArrayChangeId(arr),
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
