import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { Context, getContext } from '../src/state-utils/ctx'
import { useQuickSubscribe } from '../src/state-utils/useQuickSubscribe'

describe('useQuickSubscribe', () => {
  it('should return a proxy object', () => {
    const ctx = getContext('quick-sub-test') as Context<{ count: number }>
    
    const { result } = renderHook(() => useQuickSubscribe(ctx))

    expect(result.current).toBeDefined()
    expect(typeof result.current).toBe('object')
  })

  it('should subscribe only to accessed properties', async () => {
    const ctx = getContext('quick-selective-test') as Context<{
      count: number
      name: string
      value: number
    }>

    act(() => {
      ctx.publish('count', 10)
      ctx.publish('name', 'test')
      ctx.publish('value', 100)
    })

    let renderCount = 0
    const { result } = renderHook(() => {
      renderCount++
      const data = useQuickSubscribe(ctx)
      // Only access count and name
      return { count: data.count, name: data.name }
    })

    const initialRenderCount = renderCount

    // Change 'value' (not accessed)
    act(() => {
      ctx.publish('value', 200)
    })

    // Wait a bit to ensure no re-render
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(renderCount).toBe(initialRenderCount)

    // Change 'count' (accessed)
    act(() => {
      ctx.publish('count', 20)
    })

    await waitFor(() => {
      expect(renderCount).toBeGreaterThan(initialRenderCount)
      expect(result.current.count).toBe(20)
    })
  })

  it('should update when accessed properties change', async () => {
    const ctx = getContext('quick-update-test') as Context<{
      count: number
      message: string
    }>

    act(() => {
      ctx.publish('count', 5)
      ctx.publish('message', 'hello')
    })

    const { result } = renderHook(() => {
      const data = useQuickSubscribe(ctx)
      return { count: data.count, message: data.message }
    })

    expect(result.current.count).toBe(5)
    expect(result.current.message).toBe('hello')

    act(() => {
      ctx.publish('count', 15)
    })

    await waitFor(() => {
      expect(result.current.count).toBe(15)
    })

    act(() => {
      ctx.publish('message', 'world')
    })

    await waitFor(() => {
      expect(result.current.message).toBe('world')
    })
  })

  it('should handle undefined values', async () => {
    const ctx = getContext('quick-undefined-test') as Context<{
      optionalValue?: string
    }>

    const { result } = renderHook(() => {
      const data = useQuickSubscribe(ctx)
      return data.optionalValue
    })

    expect(result.current).toBeUndefined()

    act(() => {
      ctx.publish('optionalValue', 'now defined')
    })

    await waitFor(() => {
      expect(result.current).toBe('now defined')
    })

    act(() => {
      ctx.publish('optionalValue', undefined)
    })

    await waitFor(() => {
      expect(result.current).toBeUndefined()
    })
  })

  it('should handle dynamic property access', async () => {
    const ctx = getContext('quick-dynamic-test') as Context<{
      field1: number
      field2: number
      field3: number
    }>

    act(() => {
      ctx.publish('field1', 1)
      ctx.publish('field2', 2)
      ctx.publish('field3', 3)
    })

    const { result, rerender } = renderHook(
      ({ key }) => {
        const data = useQuickSubscribe(ctx)
        return data[key]
      },
      { initialProps: { key: 'field1' as 'field1' | 'field2' | 'field3' } }
    )

    expect(result.current).toBe(1)

    // Change to access different field
    rerender({ key: 'field2' })

    await waitFor(() => {
      expect(result.current).toBe(2)
    })

    rerender({ key: 'field3' })

    await waitFor(() => {
      expect(result.current).toBe(3)
    })
  })

  it('should work with object values', async () => {
    const ctx = getContext('quick-object-test') as Context<{
      user: { id: number; name: string }
    }>

    const user1 = { id: 1, name: 'Alice' }
    act(() => {
      ctx.publish('user', user1)
    })

    const { result } = renderHook(() => {
      const data = useQuickSubscribe(ctx)
      return data.user
    })

    expect(result.current).toEqual(user1)

    const user2 = { id: 2, name: 'Bob' }
    act(() => {
      ctx.publish('user', user2)
    })

    await waitFor(() => {
      expect(result.current).toEqual(user2)
    })
  })

  it('should work with array values', async () => {
    const ctx = getContext('quick-array-test') as Context<{
      items: number[]
    }>

    const items1 = [1, 2, 3]
    act(() => {
      ctx.publish('items', items1)
    })

    const { result } = renderHook(() => {
      const data = useQuickSubscribe(ctx)
      return data.items
    })

    expect(result.current).toEqual(items1)

    const items2 = [4, 5, 6]
    act(() => {
      ctx.publish('items', items2)
    })

    await waitFor(() => {
      expect(result.current).toEqual(items2)
    })
  })

  it('should handle multiple properties accessed in same render', async () => {
    const ctx = getContext('quick-multi-access-test') as Context<{
      a: number
      b: number
      c: number
    }>

    act(() => {
      ctx.publish('a', 10)
      ctx.publish('b', 20)
      ctx.publish('c', 30)
    })

    const { result } = renderHook(() => {
      const data = useQuickSubscribe(ctx)
      return { sum: (data.a || 0) + (data.b || 0), product: (data.a || 0) * (data.c || 0) }
    })

    expect(result.current.sum).toBe(30)
    expect(result.current.product).toBe(300)

    act(() => {
      ctx.publish('a', 5)
    })

    await waitFor(() => {
      expect(result.current.sum).toBe(25) // 5 + 20
      expect(result.current.product).toBe(150) // 5 * 30
    })
  })

  it('should not cause memory leaks on unmount', () => {
    const ctx = getContext('quick-leak-test') as Context<{ value: number }>

    act(() => {
      ctx.publish('value', 42)
    })

    const { result, unmount } = renderHook(() => {
      const data = useQuickSubscribe(ctx)
      return data.value
    })

    expect(result.current).toBe(42)

    // Unmount should clean up subscriptions
    unmount()

    // Change value after unmount
    act(() => {
      ctx.publish('value', 100)
    })

    // Should not throw or cause issues
    expect(ctx.data.value).toBe(100)
  })

  it('should handle undefined context gracefully', () => {
    // When context is undefined, the proxy should still be created but throw when accessed
    expect(() => {
      const { result } = renderHook(() => {
        const data = useQuickSubscribe(undefined as any)
        // Try to access a property - this should throw
        return (data as any).someProperty
      })
    }).toThrow()
  })

  it('should support destructuring in render', async () => {
    const ctx = getContext('quick-destructure-test') as Context<{
      x: number
      y: number
      z: number
    }>

    act(() => {
      ctx.publish('x', 1)
      ctx.publish('y', 2)
      ctx.publish('z', 3)
    })

    const { result } = renderHook(() => {
      const { x, y } = useQuickSubscribe(ctx)
      return { x, y }
    })

    expect(result.current.x).toBe(1)
    expect(result.current.y).toBe(2)

    act(() => {
      ctx.publish('x', 10)
    })

    await waitFor(() => {
      expect(result.current.x).toBe(10)
    })
  })
})
