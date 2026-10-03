import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, renderHook, act } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { createStore, AutoRootCtx, StoreErrorBoundary } from '../src/state-utils/createAutoCtx'
import { getContext, useDataSourceMultiple, type Context } from '../src/state-utils/ctx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

afterEach(() => vi.restoreAllMocks())

describe('AutoRootCtx robustness', () => {
  it('does not re-run other store hooks when an unrelated consumer mounts', async () => {
    let runsA = 0
    const { useStore: useA } = createStore('memo-a', (_: {}) => { runsA++; return { a: 1 } })
    const { useStore: useB } = createStore('memo-b', (_: {}) => ({ b: 2 }))
    const A = () => <span>{useA({}).a}</span>
    const B = () => <span>{useB({}).b}</span>

    const Host = () => {
      const [showB, setShowB] = useState(false)
      return <>
        <AutoRootCtx />
        <A />
        {showB && <B />}
        <button data-testid="toggle" onClick={() => setShowB(s => !s)} />
      </>
    }
    const { getByTestId } = render(<Host />)
    await tick()
    const before = runsA
    act(() => getByTestId('toggle').click()); await tick()
    act(() => getByTestId('toggle').click()); await tick()
    expect(runsA).toBe(before)
  })

  it('isolates a throwing store with the default error boundary', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { useStore: useBad } = createStore('bad-store', (_: {}) => { throw new Error('boom') })
    const { useStore: useGood } = createStore('good-store', (_: {}) => ({ ok: 'yes' }))
    const Bad = () => <span>{String(useBad({}).anything)}</span>
    const Good = () => <span data-testid="good">{useGood({}).ok}</span>

    const { getByTestId } = render(<><AutoRootCtx /><Bad /><Good /></>)
    await tick()
    expect(getByTestId('good').textContent).toBe('yes')
    expect(err).toHaveBeenCalledWith(expect.stringContaining('store hook threw'), expect.any(Error), expect.anything())
    expect(AutoRootCtx).toBeDefined()
    expect(StoreErrorBoundary).toBeDefined()
  })

  it('a divergent store cycle is capped by React and does not hang or affect other stores', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let storeB: any
    let rendersA = 0
    const storeA = createStore('diverge-A', (_: {}) => { rendersA++; return { a: ((storeB.useStore().b as number) || 0) + 1 } })
    storeB = createStore('diverge-B', (_: {}) => ({ b: ((storeA.useStore().a as number) || 0) + 1 }))
    const { useStore: useHealthy } = createStore('healthy', (_: {}) => ({ ok: 'yes' }))
    const Loop = () => <span data-testid="loop">{String(storeA.useStore().a)}</span>
    const Healthy = () => <span data-testid="ok">{useHealthy().ok}</span>

    const t0 = Date.now()
    const { getByTestId } = render(<><AutoRootCtx /><Loop /><Healthy /></>)
    await tick(100)
    expect(Date.now() - t0).toBeLessThan(2000)

    // The cascade ran synchronously until React's nested-update limit threw inside a store's
    // publish; the error reached that store's StoreErrorBoundary, which disabled it and ended the cycle.
    const settled = rendersA
    const shown = getByTestId('loop').textContent
    expect(settled).toBeGreaterThan(10)
    await tick(200)
    expect(rendersA).toBe(settled)
    expect(getByTestId('loop').textContent).toBe(shown)
    expect(getByTestId('ok').textContent).toBe('yes')
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining('store hook threw'),
      expect.objectContaining({ message: expect.stringContaining('Maximum update depth exceeded') }),
      expect.anything()
    )
  })

  it('publishes undefined and removes keys the store hook stops returning', () => {
    const ctx = getContext('removed-keys') as Context<{ a?: number, b?: number }>
    const { rerender } = renderHook(
      ({ withB }: { withB: boolean }) => useDataSourceMultiple(ctx, ...(withB ? [['a', 1], ['b', 2]] : [['a', 1]]) as any),
      { initialProps: { withB: true } }
    )
    expect(ctx.data).toEqual({ a: 1, b: 2 })
    const seen: unknown[] = []
    ctx.subscribe('b', v => seen.push(v))
    rerender({ withB: false })
    expect(seen).toEqual([2, undefined])
    expect('b' in ctx.data).toBe(false)
    expect(ctx.data).toEqual({ a: 1 })
  })

  it('publishes before paint (layout effect) so a consumer in the same commit reads the value', () => {
    const ctx = getContext('layout-publish') as Context<{ v: number }>
    const seenInEffect: unknown[] = []
    const Producer = () => { useDataSourceMultiple(ctx, ['v', 42]); return null }
    const Observer = () => {
      // a passive effect runs after all layout effects; the value must already be there
      useEffect(() => { seenInEffect.push(ctx.data.v) }, [])
      return null
    }
    render(<><Producer /><Observer /></>)
    // StrictMode runs the effect twice; every observation must already see the published value
    expect(seenInEffect.length).toBeGreaterThan(0)
    expect(seenInEffect.every(v => v === 42)).toBe(true)
  })
})

describe('store names', () => {
  // Instances are records keyed by name: a name inherited from Object.prototype must not count as
  // present already, and `__proto__` must be a key, not the prototype.
  it.each(['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__proto__'])('a store named %s starts and stops', async (name) => {
    const life = { mounts: 0, unmounts: 0 }
    const { useStore } = createStore(name, () => {
      useEffect(() => { life.mounts++; return () => { life.unmounts++ } }, [])
      return { v: 'running' }
    })
    const View = () => <span data-testid="v">{useStore().v ?? 'not started'}</span>
    const { getByTestId, rerender } = render(<><AutoRootCtx /><View /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('running')
    rerender(<><AutoRootCtx /></>)
    await tick()
    expect(life.mounts - life.unmounts).toBe(0) // StrictMode runs effects twice
  })
})
