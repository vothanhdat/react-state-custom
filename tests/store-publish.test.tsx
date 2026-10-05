import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'
import { getContext } from '../src/state-utils/ctx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

describe('what a store publishes', () => {
  it('removes a key the hook stops returning, and publishes it again when it comes back', async () => {
    const { useStore, getStore } = createStore('publish-remove', () => {
      const [withB, setWithB] = useState(true)
      return withB ? { a: 1, b: 2, setWithB } : { a: 1, setWithB }
    })
    const View = () => { const { b } = useStore(); return <span data-testid="b">{String(b)}</span> }
    const { getByTestId } = render(<><AutoRootCtx /><View /></>)
    await tick()
    expect(getByTestId('b').textContent).toBe('2')
    act(() => getStore().get().setWithB!(false))
    await tick()
    expect(getByTestId('b').textContent).toBe('undefined')
    expect('b' in getContext('publish-remove').data).toBe(false)
    act(() => getStore().get().setWithB!(true))
    await tick()
    expect(getByTestId('b').textContent).toBe('2')
  })

  it('a key that switches between a function and a plain value publishes each correctly', async () => {
    const { useStore, getStore } = createStore('publish-fn-value', () => {
      const [asFn, setAsFn] = useState(true)
      return { label: asFn ? () => 'fn' : 'value', setAsFn }
    })
    const View = () => {
      const { label } = useStore()
      return <span data-testid="v">{typeof label === 'function' ? label() : String(label)}</span>
    }
    const { getByTestId } = render(<><AutoRootCtx /><View /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('fn')
    act(() => getStore().get().setAsFn!(false))
    await tick()
    expect(getByTestId('v').textContent).toBe('value')
    act(() => getStore().get().setAsFn!(true))
    await tick()
    expect(getByTestId('v').textContent).toBe('fn')
  })

  it('preState is what an earlier instance published, read once on mount', async () => {
    const seen: unknown[] = []
    const { useStore, getStore } = createStore('publish-prestate', (_: {}, preState: Partial<{ n: number }>) => {
      // committed renders only: StrictMode in React 18 also mounts, then discards, a first render
      useEffect(() => { seen.push(preState) })
      const [n, setN] = useState(preState.n ?? 0)
      return { n, setN }
    }, { timeToClean: 0 })
    const View = () => { const { n } = useStore(); return <span>{n}</span> }
    const r = render(<><AutoRootCtx /><View /></>)
    await tick()
    act(() => getStore().get().setN!(5))
    await tick()
    expect(new Set(seen).size).toBe(1)             // the same object on every render of the instance
    const stop = getStore().subscribe(() => { })   // something holds the context with no component reading it
    r.rerender(<AutoRootCtx />)                    // last consumer leaves: the instance is torn down
    await tick(10)
    expect(getStore().get().n).toBe(5)             // its values stay
    expect(getStore().get().setN).toBeUndefined()  // its actions are gone
    r.rerender(<><AutoRootCtx /><View /></>)       // a new instance warm-starts from it
    await tick()
    expect(getStore().get().n).toBe(5)
    stop()
  })

  it('a torn-down instance whose context nothing holds leaves nothing behind: the next one starts fresh', async () => {
    const { useStore, getStore } = createStore('publish-fresh', (_: {}, preState: Partial<{ n: number }>) => {
      const [n, setN] = useState(preState.n ?? 0)
      return { n, setN }
    }, { timeToClean: 0 })
    const View = () => { const { n } = useStore(); return <span>{n}</span> }
    const r = render(<><AutoRootCtx /><View /></>)
    await tick()
    act(() => getStore().get().setN!(5))
    await tick()
    r.rerender(<AutoRootCtx />)                    // the instance is torn down, and its context evicted at once
    await tick(10)                                 // up to 1.6, the context stayed cached for 100 ms
    r.rerender(<><AutoRootCtx /><View /></>)
    await tick()
    expect(getStore().get().n).toBe(0)
  })
})
