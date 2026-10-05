import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { Component, useEffect, useState, type ReactNode } from 'react'
import { createStore, AutoRootCtx } from '../src'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

afterEach(() => vi.restoreAllMocks())

/** An error boundary that records what it caught and renders nothing after. */
class Catch extends Component<{ children?: ReactNode, onError: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { this.props.onError(error) }
  render() { return this.state.failed ? null : this.props.children }
}

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

  it('isolates a throwing store: its reader throws for its own boundary, other stores keep running', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { useStore: useBad } = createStore('bad-store', (_: {}): { anything?: string } => { throw new Error('boom') })
    const { useStore: useGood } = createStore('good-store', (_: {}) => ({ ok: 'yes' }))
    const Bad = () => <span>{String(useBad({}).anything)}</span>
    const Good = () => <span data-testid="good">{useGood({}).ok}</span>
    const caught: unknown[] = []

    const { getByTestId } = render(<><AutoRootCtx /><Catch onError={e => caught.push(e)}><Bad /></Catch><Good /></>)
    await tick()
    expect(getByTestId('good').textContent).toBe('yes')
    expect(caught.map(e => (e as Error).message)).toEqual(['boom'])
    expect(err).toHaveBeenCalledWith(expect.stringContaining('store hook threw'), expect.any(Error), expect.anything())
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

    const caught: unknown[] = []

    const t0 = Date.now()
    const { getByTestId } = render(<><AutoRootCtx /><Catch onError={e => caught.push(e)}><Loop /></Catch><Healthy /></>)
    await tick(100)
    expect(Date.now() - t0).toBeLessThan(2000)

    // The cascade ran synchronously until React's nested-update limit threw inside a store's
    // publish; the error reached that store's boundary, which disabled it and ended the cycle, and
    // the component reading the loop got the error.
    const settled = rendersA
    expect(settled).toBeGreaterThan(10)
    await tick(200)
    expect(rendersA).toBe(settled)
    expect(caught.some(e => String((e as Error).message).includes('Maximum update depth exceeded'))).toBe(true)
    expect(getByTestId('ok').textContent).toBe('yes')
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining('store hook threw'),
      expect.objectContaining({ message: expect.stringContaining('Maximum update depth exceeded') }),
      expect.anything()
    )
  })

  it('publishes undefined and removes keys the store hook stops returning', async () => {
    const { storeRef } = createStore('removed-keys', () => {
      const [withB, setWithB] = useState(true)
      const drop = () => setWithB(false)
      return withB ? { a: 1, b: 2, drop } : { a: 1, drop }
    })
    render(<AutoRootCtx />)
    const release = storeRef().retain()
    await tick()
    expect(storeRef().get()).toMatchObject({ a: 1, b: 2 })
    const seen: unknown[] = []
    const stop = storeRef().subscribe((state, key) => seen.push([key, state.b]))
    await act(async () => { storeRef().get().drop!() })
    expect(seen).toEqual([['b', undefined]])
    expect('b' in storeRef().get()).toBe(false)
    stop()
    release()
  })

  it('publishes before paint (layout effect), so every passive effect of the commit reads the value', async () => {
    let setV!: (v: number) => void
    const { storeRef } = createStore('layout-publish', () => {
      const [v, set] = useState(0)
      setV = set
      return { v }
    })
    const seenInEffect: unknown[] = []
    let setTick!: (n: number) => void
    // rendered before AutoRootCtx: its passive effect runs before those of the store
    const Observer = () => {
      const [t, set] = useState(0)
      setTick = set
      useEffect(() => { if (t > 0) seenInEffect.push(storeRef().get().v) }, [t])
      return null
    }
    render(<><Observer /><AutoRootCtx /></>)
    const release = storeRef().retain()
    await tick()
    act(() => { setV(42); setTick(1) })
    expect(seenInEffect).toEqual([42])
    release()
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
