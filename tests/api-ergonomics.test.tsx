import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, renderHook, act } from '@testing-library/react'
import { useState } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'
import { getContext, useDataContext } from '../src/state-utils/ctx'
import { DependencyTracker } from '../src/state-utils/utils'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })
afterEach(() => vi.restoreAllMocks())

describe('createStore options', () => {
  it('seeds initialState so the very first render has values, then the store takes over', async () => {
    const useUser = ({ userId }: { userId: string }) => {
      const [user] = useState(() => ({ id: userId, name: 'Ada' }))
      return { user, isLoading: false }
    }
    const { useStore } = createStore('seeded', useUser, {
      initialState: { user: null as { id: string, name: string } | null, isLoading: true },
    })
    const firstRender: unknown[] = []
    const C = () => {
      const { user, isLoading } = useStore({ userId: 'u1' })
      // types: non-optional because they are in initialState
      const _check: boolean = isLoading
      void _check
      if (firstRender.length === 0) firstRender.push(user, isLoading)
      return <span data-testid="out">{isLoading ? 'loading' : user!.name}</span>
    }
    const { getByTestId } = render(<><AutoRootCtx /><C /></>)
    expect(firstRender).toEqual([null, true])
    await tick()
    expect(getByTestId('out').textContent).toBe('Ada')
  })

  it('accepts initialState as a function of params and a bare number as timeToClean', async () => {
    const { useStore } = createStore('seeded-fn', ({ n }: { n: number }) => ({ double: n * 2 }), {
      initialState: ({ n }) => ({ double: n * 2 }),
      timeToClean: 0,
    })
    const { result } = renderHook(() => useStore({ n: 21 }).double)
    expect(result.current).toBe(42)

    const legacy = createStore('legacy-number', (_: {}) => ({ v: 1 }), 5000)
    expect(typeof legacy.useStore).toBe('function')
  })

  it('allows useStore() without params when the store has none', async () => {
    const { useStore } = createStore('no-params', (_: {}) => ({ v: 7 }))
    const C = () => <span data-testid="v">{String(useStore().v)}</span>
    const { getByTestId } = render(<><AutoRootCtx /><C /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('7')
  })
})

describe('proxy ergonomics', () => {
  it('symbol keys pass through without being tracked and without warnings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ctx = getContext('symbols')
    ctx.publish('a', 1)
    const { useStore } = createStore('symbols-store', (_: {}) => ({ a: 1 }))
    const { result } = renderHook(() => useStore())
    expect((result.current as any)[Symbol.toPrimitive]).toBeUndefined()
    expect(String(result.current)).toBe('[object Object]')
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('dependency graph hygiene', () => {
  it('forgets a store when its context is evicted', async () => {
    DependencyTracker.graph.set('evicted-dep', new Set(['other']))
    DependencyTracker.graph.set('other', new Set(['evicted-dep']))
    const { unmount } = renderHook(() => useDataContext('evicted-dep'))
    unmount()
    await tick(150)
    expect(DependencyTracker.graph.has('evicted-dep')).toBe(false)
    expect(DependencyTracker.graph.get('other')?.has('evicted-dep')).toBe(false)
    DependencyTracker.graph.delete('other')
  })
})
