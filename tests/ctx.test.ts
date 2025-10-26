import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { 
  Context, 
  getContext, 
  useDataContext,
  useDataSource,
  useDataSubscribe,
  useDataSourceMultiple,
  useDataSubscribeMultiple
} from '../src/state-utils/ctx'

describe('Context', () => {
  let ctx: Context<{ count: number; name: string }>

  beforeEach(() => {
    ctx = new Context('test-context')
  })

  it('should create a context with a name', () => {
    expect(ctx.name).toBe('test-context')
    expect(ctx.data).toEqual({})
  })

  it('should publish and notify subscribers when value changes', () => {
    const listener = vi.fn()
    ctx.subscribe('count', listener)

    act(() => {
      ctx.publish('count', 5)
    })

    expect(listener).toHaveBeenCalledWith(5)
    expect(ctx.data.count).toBe(5)
  })

  it('should not notify when value is the same (shallow comparison)', () => {
    const listener = vi.fn()
    
    act(() => {
      ctx.publish('count', 5)
    })
    
    ctx.subscribe('count', listener)
    listener.mockClear()

    act(() => {
      ctx.publish('count', 5)
    })

    expect(listener).not.toHaveBeenCalled()
  })

  it('should notify subscriber immediately with current value', () => {
    act(() => {
      ctx.publish('count', 10)
    })

    const listener = vi.fn()
    ctx.subscribe('count', listener)

    expect(listener).toHaveBeenCalledWith(10)
  })

  it('should handle multiple subscribers for the same key', () => {
    const listener1 = vi.fn()
    const listener2 = vi.fn()

    ctx.subscribe('count', listener1)
    ctx.subscribe('count', listener2)

    act(() => {
      ctx.publish('count', 7)
    })

    expect(listener1).toHaveBeenCalledWith(7)
    expect(listener2).toHaveBeenCalledWith(7)
  })

  it('should unsubscribe correctly', () => {
    const listener = vi.fn()
    const unsubscribe = ctx.subscribe('count', listener)

    act(() => {
      ctx.publish('count', 3)
    })

    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    listener.mockClear()

    act(() => {
      ctx.publish('count', 8)
    })

    expect(listener).not.toHaveBeenCalled()
  })

  it('should handle subscribeAll for any key change', () => {
    const listener = vi.fn()
    ctx.subscribeAll(listener)

    act(() => {
      ctx.publish('count', 5)
    })

    expect(listener).toHaveBeenCalledWith('count', { count: 5 })

    act(() => {
      ctx.publish('name', 'test')
    })

    expect(listener).toHaveBeenCalledWith('name', { count: 5, name: 'test' })
  })
})

describe('getContext', () => {
  it('should memoize context instances by name', () => {
    const ctx1 = getContext('my-context')
    const ctx2 = getContext('my-context')

    expect(ctx1).toBe(ctx2)
  })

  it('should return different instances for different names', () => {
    const ctx1 = getContext('context-1')
    const ctx2 = getContext('context-2')

    expect(ctx1).not.toBe(ctx2)
  })
})

describe('useDataContext', () => {
  it('should return a context instance', () => {
    const { result } = renderHook(() => useDataContext('hook-context'))

    expect(result.current).toBeInstanceOf(Context)
    expect(result.current.name).toBe('hook-context')
  })

  it('should increment useCounter on mount and decrement on unmount', () => {
    const { result, unmount } = renderHook(() => useDataContext('counter-context'))

    expect(result.current.useCounter).toBe(1)

    unmount()

    // Counter should be decremented after unmount
    expect(result.current.useCounter).toBe(0)
  })
})

describe('useDataSource', () => {
  it('should publish value on mount', () => {
    const ctx = getContext('source-context')
    
    renderHook(() => useDataSource(ctx, 'count', 42))

    expect(ctx.data.count).toBe(42)
  })

  it('should update when value changes', () => {
    const ctx = getContext('source-update-context')
    
    const { rerender } = renderHook(
      ({ value }) => useDataSource(ctx, 'count', value),
      { initialProps: { value: 10 } }
    )

    expect(ctx.data.count).toBe(10)

    rerender({ value: 20 })

    expect(ctx.data.count).toBe(20)
  })

  it('should not publish if value unchanged', () => {
    const ctx = getContext('source-unchanged-context')
    const publishSpy = vi.spyOn(ctx, 'publish')
    
    const { rerender } = renderHook(
      ({ value }) => useDataSource(ctx, 'count', value),
      { initialProps: { value: 5 } }
    )

    expect(publishSpy).toHaveBeenCalledTimes(1)

    rerender({ value: 5 })

    // Should still be 1 because value didn't change
    expect(publishSpy).toHaveBeenCalledTimes(1)
  })
})

describe('useDataSubscribe', () => {
  it('should subscribe to a single key', () => {
    const ctx = getContext('subscribe-context')
    
    act(() => {
      ctx.publish('count', 100)
    })

    const { result } = renderHook(() => useDataSubscribe(ctx, 'count'))

    expect(result.current).toBe(100)
  })

  it('should re-render when subscribed key changes', async () => {
    const ctx = getContext('subscribe-rerender-context')
    
    const { result } = renderHook(() => useDataSubscribe(ctx, 'count'))

    expect(result.current).toBeUndefined()

    act(() => {
      ctx.publish('count', 50)
    })

    await waitFor(() => {
      expect(result.current).toBe(50)
    })
  })

  it('should handle debounce correctly', async () => {
    const ctx = getContext('subscribe-debounce-context')
    
    const { result } = renderHook(() => useDataSubscribe(ctx, 'count', 50))

    expect(result.current).toBeUndefined()

    act(() => {
      ctx.publish('count', 1)
    })
    
    act(() => {
      ctx.publish('count', 2)
    })
    
    act(() => {
      ctx.publish('count', 3)
    })

    // Should debounce and only apply the last value after delay
    await waitFor(() => {
      expect(result.current).toBe(3)
    }, { timeout: 200 })
  })
})

describe('useDataSourceMultiple', () => {
  it('should publish multiple key-value pairs', () => {
    const ctx = getContext('multi-source-context')
    
    renderHook(() => 
      useDataSourceMultiple(
        ctx,
        ['count', 10] as const,
        ['name', 'test'] as const
      )
    )

    expect(ctx.data.count).toBe(10)
    expect(ctx.data.name).toBe('test')
  })
})

describe('useDataSubscribeMultiple', () => {
  it('should subscribe to multiple keys', async () => {
    const ctx = getContext('multi-subscribe-context')
    
    act(() => {
      ctx.publish('count', 25)
      ctx.publish('name', 'Alice')
    })

    const { result } = renderHook(() => 
      useDataSubscribeMultiple(ctx, 'count', 'name')
    )

    await waitFor(() => {
      expect(result.current).toEqual({
        count: 25,
        name: 'Alice'
      })
    })
  })

  it('should only re-render when subscribed keys change', async () => {
    const ctx = getContext('multi-subscribe-selective-context') as Context<{ count: number; name: string; other: string }>
    let renderCount = 0
    
    const { result } = renderHook(() => {
      renderCount++
      return useDataSubscribeMultiple(ctx, 'count', 'name')
    })

    const initialRenderCount = renderCount

    act(() => {
      ctx.publish('count', 30)
    })

    await waitFor(() => {
      expect((result.current as any).count).toBe(30)
    })

    expect(renderCount).toBeGreaterThan(initialRenderCount)

    const countAfterUpdate = renderCount

    // Publishing to a non-subscribed key shouldn't cause re-render
    act(() => {
      ctx.publish('other', 'value')
    })

    // Wait a bit to ensure no re-render happens
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(renderCount).toBe(countAfterUpdate)
  })
})
