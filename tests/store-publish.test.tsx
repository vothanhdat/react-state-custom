import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { useState } from 'react'
import { createStore, AutoRootCtx } from '../src'
import { getContext } from '../src/state-utils/ctx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

describe('what a store publishes', () => {
  it('removes a key the hook stops returning, and publishes it again when it comes back', async () => {
    const { useStore, storeRef } = createStore('publish-remove', () => {
      const [withB, setWithB] = useState(true)
      return withB ? { a: 1, b: 2, setWithB } : { a: 1, setWithB }
    })
    const View = () => { const { b } = useStore(); return <span data-testid="b">{String(b)}</span> }
    const { getByTestId } = render(<><AutoRootCtx /><View /></>)
    await tick()
    expect(getByTestId('b').textContent).toBe('2')
    act(() => storeRef().get().setWithB!(false))
    await tick()
    expect(getByTestId('b').textContent).toBe('undefined')
    expect('b' in getContext('publish-remove').data).toBe(false)
    act(() => storeRef().get().setWithB!(true))
    await tick()
    expect(getByTestId('b').textContent).toBe('2')
  })

  it('a key that switches between a function and a plain value publishes each correctly', async () => {
    const { useStore, storeRef } = createStore('publish-fn-value', () => {
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
    act(() => storeRef().get().setAsFn!(false))
    await tick()
    expect(getByTestId('v').textContent).toBe('value')
    act(() => storeRef().get().setAsFn!(true))
    await tick()
    expect(getByTestId('v').textContent).toBe('fn')
  })

  it('a torn-down instance leaves its values to whoever holds the context, without its actions; the next one starts fresh', async () => {
    const { useStore, storeRef } = createStore('publish-retired', (_: {}) => {
      const [n, setN] = useState(0)
      return { n, setN }
    }, { timeToClean: 0 })
    const View = () => { const { n } = useStore(); return <span>{n}</span> }
    const r = render(<><AutoRootCtx /><View /></>)
    await tick()
    act(() => storeRef().get().setN!(5))
    await tick()
    const stop = storeRef().subscribe(() => { })   // something holds the context with no component reading it
    r.rerender(<AutoRootCtx />)                    // last consumer leaves: the instance is torn down
    await tick(10)
    expect(storeRef().get().n).toBe(5)             // its values stay
    expect(storeRef().get().setN).toBeUndefined()  // its actions are gone
    r.rerender(<><AutoRootCtx /><View /></>)       // a new instance starts from its own state
    await tick()
    expect(storeRef().get().n).toBe(0)
    stop()
  })

  it('a new instance starts from its own keys, without those an earlier instance left', async () => {
    const { useStore, storeRef } = createStore('publish-left-keys', () => {
      const [items, setItems] = useState<Record<string, number>>({})
      return { ...items, add: (key: string) => setItems(s => ({ ...s, [key]: 1 })) } as Record<string, number> & { add: (key: string) => void }
    })
    const Keys = () => <i data-testid="keys">{Object.keys(useStore()).sort().join(',')}</i>
    // the reader stays mounted, so it holds the context while AutoRootCtx starts every store afresh
    const r = render(<><AutoRootCtx key={0} /><Keys /></>)
    await tick()
    await act(async () => { storeRef().get().add('a') })
    expect(r.getByTestId('keys').textContent).toBe('a,add')
    r.rerender(<><AutoRootCtx key={1} /><Keys /></>)
    await tick()
    expect(r.getByTestId('keys').textContent).toBe('add')
    expect(storeRef().get()).toEqual({ add: expect.any(Function) })
  })

  it('a torn-down instance whose context nothing holds leaves nothing behind', async () => {
    const { useStore, storeRef } = createStore('publish-fresh', (_: {}) => {
      const [n, setN] = useState(0)
      return { n, setN }
    }, { timeToClean: 0 })
    const View = () => { const { n } = useStore(); return <span>{n}</span> }
    const r = render(<><AutoRootCtx /><View /></>)
    await tick()
    act(() => storeRef().get().setN!(5))
    await tick()
    r.rerender(<AutoRootCtx />)                    // the instance is torn down, and its context evicted at once
    await tick(10)                                 // up to 1.6, the context stayed cached for 100 ms
    expect(storeRef().get()).toEqual({})
    r.rerender(<><AutoRootCtx /><View /></>)
    await tick()
    expect(storeRef().get().n).toBe(0)
  })
})
