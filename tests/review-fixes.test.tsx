import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, renderHook, act } from '@testing-library/react'
import { useState } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'
import { createRootCtx } from '../src/state-utils/createRootCtx'
import { getContext, useDataContext, useDataSubscribe, useDataSubscribeMultiple, type Context } from '../src/state-utils/ctx'
import { paramsToId } from '../src/state-utils/paramsToId'
import { useQuickSubscribe } from '../src/state-utils/useQuickSubscribe'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

afterEach(() => vi.restoreAllMocks())

describe('stable action identity', () => {
  it('keeps the same function identity across store renders and forwards to the latest closure', async () => {
    let setOther: (n: number) => void = () => {}
    let seenOther = -1
    const useS = ({}: {}) => {
      const [count, setCount] = useState(0)
      const [other, _setOther] = useState(0)
      setOther = _setOther
      const increment = () => setCount(c => c + 1)
      const readOther = () => { seenOther = other }
      return { count, other, increment, readOther }
    }
    const { useStore } = createStore('stable-actions', useS)

    const seen: Function[] = []
    let renders = 0
    const C = () => {
      renders++
      const { count, increment, readOther } = useStore({})
      if (increment) seen.push(increment)
      return <><button onClick={increment} data-testid="btn">{count}</button><i onClick={readOther} data-testid="read" /></>
    }
    const { getByTestId } = render(<><AutoRootCtx /><C /></>)
    await tick()
    const rendersBefore = renders

    // unrelated key changes must not re-render a consumer that only reads count + actions
    await act(async () => { setOther(5) }); await tick()
    await act(async () => { setOther(6) }); await tick()
    expect(renders).toBe(rendersBefore)

    // the action is the same reference everywhere and still calls the newest closure
    expect(new Set(seen).size).toBe(1)
    act(() => { getByTestId('read').click() })
    expect(seenOther).toBe(6)

    act(() => { getByTestId('btn').click() })
    await tick()
    expect(getByTestId('btn').textContent).toBe('1')
    expect(new Set(seen).size).toBe(1)
  })

  it('does not wrap classes', () => {
    class Model {}
    const { useRootState } = createRootCtx('class-value', (_: {}) => ({ Model }))
    const { result } = renderHook(() => useRootState({}))
    expect(result.current.Model).toBe(Model)
  })
})

describe('Object.is change detection', () => {
  it('publishes 0 over "" and null over undefined', () => {
    const ctx = getContext('objectis') as Context<{ v: unknown }>
    const values: unknown[] = []
    ctx.subscribe('v', v => values.push(v))
    ctx.publish('v', '')
    ctx.publish('v', 0)
    ctx.publish('v', undefined)
    ctx.publish('v', null)
    ctx.publish('v', null) // no-op
    expect(values).toEqual(['', 0, undefined, null])
  })
})

describe('synchronous propagation', () => {
  it('delivers updates to useDataSubscribe and useDataSubscribeMultiple in the same act, without timers', () => {
    const ctx = getContext('sync') as Context<{ a: number, b: number }>
    const { result } = renderHook(() => ({
      a: useDataSubscribe(ctx, 'a'),
      both: useDataSubscribeMultiple(ctx, 'a', 'b'),
      quick: useQuickSubscribe(ctx).a,
    }))
    act(() => { ctx.publish('a', 1); ctx.publish('b', 2) })
    expect(result.current.a).toBe(1)
    expect(result.current.both).toEqual({ a: 1, b: 2 })
    expect(result.current.quick).toBe(1)
  })

  it('useDataSubscribeMultiple returns a stable object until a value changes', () => {
    const ctx = getContext('stable-multi') as Context<{ a: number, b: number }>
    ctx.publish('a', 1); ctx.publish('b', 2)
    const { result, rerender } = renderHook(() => useDataSubscribeMultiple(ctx, 'a', 'b'))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    act(() => ctx.publish('a', 1)) // same value, no change
    expect(result.current).toBe(first)
    act(() => ctx.publish('a', 3))
    expect(result.current).not.toBe(first)
    expect(result.current.a).toBe(3)
  })
})

describe('context cache lifecycle', () => {
  it('evicts after the last user unmounts and never deletes a different live instance', async () => {
    const { unmount } = renderHook(() => useDataContext('evict-me'))
    const first = getContext.fromCache('evict-me')
    expect(first).toBeDefined()
    unmount()
    await tick(150)
    expect(getContext.fromCache('evict-me')).toBeUndefined()

    // a new user after eviction gets a fresh instance that stays alive
    const second = renderHook(() => useDataContext('evict-me'))
    const fresh = getContext.fromCache('evict-me')
    expect(fresh).toBeDefined()
    expect(fresh).not.toBe(first)
    await tick(150)
    expect(getContext.fromCache('evict-me')).toBe(fresh)
    expect(second.result.current).toBe(fresh)
  })

})

describe('paramsToId escaping', () => {
  it('does not collide on separator characters', () => {
    expect(paramsToId({ a: '1&b=2' })).not.toBe(paramsToId({ a: '1', b: '2' }))
    expect(paramsToId({ q: 'x?y' })).toBe('q=x%3Fy')
    expect(paramsToId({ name: 'john', age: 30 })).toBe('age=30&name=john')
    expect(paramsToId({ id: null, active: true })).toBe('active=true&id=null')
    expect(paramsToId()).toBe('')
  })
})

describe('missing AutoRootCtx', () => {
  it('logs a console.error after a grace period instead of failing silently', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { useStore } = createStore('orphan', (_: {}) => ({ v: 1 }))
    const C = () => { const { v } = useStore({}); return <span>{String(v)}</span> }
    render(<C />)
    await tick(1100)
    expect(err).toHaveBeenCalledWith(expect.stringContaining('no <AutoRootCtx />'))
  })

  it('does not log when AutoRootCtx is present', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { useStore } = createStore('not-orphan', (_: {}) => ({ v: 1 }))
    const C = () => { const { v } = useStore({}); return <span>{String(v)}</span> }
    render(<><AutoRootCtx /><C /></>)
    await tick(1100)
    expect(err).not.toHaveBeenCalled()
  })
})
