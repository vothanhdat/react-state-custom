import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Context, getContext, useDataContext } from '../src/state-utils/ctx'

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

  it('notifies every subscriber even if one throws, then rethrows the first error', () => {
    const first = vi.fn(() => { throw new Error('first') })
    const second = vi.fn()
    const all = vi.fn(() => { throw new Error('all') })
    ctx.subscribe('count', first)
    ctx.subscribe('count', second)
    ctx.subscribeAll(all)

    expect(() => ctx.publish('count', 1)).toThrow('first')
    expect(second).toHaveBeenCalledWith(1)
    expect(all).toHaveBeenCalledWith('count', { count: 1 })
    expect(ctx.data.count).toBe(1)
  })

  it('registers the same listener twice and removes one registration per unsubscribe', () => {
    const listener = vi.fn()
    const unsub1 = ctx.subscribe('count', listener)
    ctx.subscribe('count', listener)

    ctx.publish('count', 1)
    expect(listener).toHaveBeenCalledTimes(2)

    unsub1()
    ctx.publish('count', 2)
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('bumps revision on every change, before subscribers run, and not for equal values', () => {
    const seen: number[] = []
    ctx.subscribeAll(() => seen.push(ctx.revision))
    const start = ctx.revision

    ctx.publish('count', 1)
    ctx.publish('count', 1)
    expect(ctx.revision).toBe(start + 1)

    ctx.publishMany([['count', 2], ['name', 'x']])
    expect(ctx.revision).toBe(start + 2)

    ctx.touch(['count'])
    expect(ctx.revision).toBe(start + 3)
    expect(seen).toEqual([start + 1, start + 2, start + 2, start + 3])
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
