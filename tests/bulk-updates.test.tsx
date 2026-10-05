import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useState } from 'react'
import { createStore, AutoRootCtx } from '../src'
import { Context } from '../src/state-utils/ctx'
import { useQuickSubscribe } from '../src/state-utils/useQuickSubscribe'

/**
 * One store update that changes N keys notifies every subscription once per key, and a component
 * subscribing to N keys hears each of them reported at once. A reader that re-checks all its reads
 * on each notification is O(N²): 4000 keys took 0.6 s per update in jsdom. These tests count the
 * comparisons the readers make (Object.is, Reflect.ownKeys), which stay linear when each reader
 * checks once per update. React captures its own Object.is at load, so the spies count ours only.
 */

const N = 500

const keyedStore = (name: string) => {
  const keys = Array.from({ length: N }, (_, i) => 'id' + i)
  let bump = () => { }
  const store = createStore(name, () => {
    const [v, setV] = useState(0)
    bump = () => setV(x => x + 1)
    const items: Record<string, number> = {}
    for (const key of keys) items[key] = v
    return items
  })
  return { ...store, keys, bump: () => bump() }
}

/** Count calls of `obj[method]` while `fn` runs. */
const countCalls = async <T extends object>(obj: T, method: keyof T, fn: () => void | Promise<void>) => {
  const spy = vi.spyOn(obj, method as any)
  try {
    await act(async () => { await fn() })
    return spy.mock.calls.length
  } finally {
    spy.mockRestore()
  }
}

afterEach(() => vi.restoreAllMocks())

describe('updates and mounts with many keys stay linear', () => {
  it('a component listing the keys checks once when every item changes', async () => {
    const { useStore, bump } = keyedStore('bulk-list')
    let renders = 0
    const List = () => { renders++; return <span>{Object.keys(useStore()).length}</span> }
    const { container } = render(<><AutoRootCtx /><List /></>)
    await act(async () => { })
    expect(container.textContent).toBe(String(N))
    const before = renders

    const listings = await countCalls(Reflect, 'ownKeys', bump)

    // was one listing per changed key
    expect(listings).toBeLessThan(10)
    // the keys did not change, so the list did not render
    expect(renders).toBe(before)
  })

  it('a component reading every key mounts and updates in linear time', async () => {
    const { useStore, keys, bump } = keyedStore('bulk-wide')
    const Wide = () => {
      const store = useStore()
      let total = 0
      for (const key of keys) total += store[key] ?? 0
      return <b>{total}</b>
    }
    let show = (_: boolean) => { }
    const App = () => {
      const [on, setOn] = useState(false)
      show = setOn
      return <><AutoRootCtx /><Probe />{on && <Wide />}</>
    }
    // keeps the store running before Wide mounts, so Wide subscribes to keys that already hold values
    const Probe = () => <i>{useStore().id0}</i>
    const { container } = render(<App />)
    await act(async () => { })

    // subscribing reports each present key at once: was one full check per key
    const onMount = await countCalls(Object, 'is', () => show(true))
    expect(onMount).toBeLessThan(10 * N)
    expect(container.querySelector('b')!.textContent).toBe('0')

    const onUpdate = await countCalls(Object, 'is', bump)
    expect(onUpdate).toBeLessThan(20 * N)
    expect(container.querySelector('b')!.textContent).toBe(String(N))
  })

  it('storeRef().subscribe gets one snapshot per update, once per changed key', async () => {
    const { storeRef } = createStore('bulk-handle', () => {
      const [n, setN] = useState(1)
      return { a: n, b: n * 2, c: n * 3, setN }
    })
    render(<AutoRootCtx />)
    const release = storeRef().retain()
    await act(async () => { })
    const calls: { key: string, state: object }[] = []
    const stop = storeRef().subscribe((state, key) => calls.push({ key: String(key), state }))

    await act(async () => { storeRef().get().setN!(2) })
    expect(calls.map(c => c.key)).toEqual(['a', 'b', 'c'])
    expect(calls[0].state).toMatchObject({ a: 2, b: 4, c: 6 })
    expect(calls.every(c => c.state === calls[0].state)).toBe(true)

    await act(async () => { storeRef().get().setN!(3) })
    expect(calls).toHaveLength(6)
    expect(calls[3].state).not.toBe(calls[0].state)
    expect(calls[3].state).toMatchObject({ a: 3, b: 6, c: 9 })
    stop()
    release()
  })

  it('a reader still sees each of several updates made in a row', () => {
    const ctx = new Context<{ a: number, b: number }>('bulk-in-a-row')
    ctx.data = { a: 0, b: 0 }
    let renders = 0
    const Reader = () => {
      renders++
      return <b>{useQuickSubscribe(ctx).a}</b>
    }
    const { container } = render(<Reader />, { reactStrictMode: false })
    act(() => {
      // a change it does not read, then one it reads: the second is a new revision and is checked
      ctx.publish('b', 1)
      ctx.publish('a', 1)
    })
    expect(container.textContent).toBe('1')
    act(() => { ctx.publishMany([['b', 2], ['a', 2]]) })
    expect(container.textContent).toBe('2')
    expect(renders).toBe(3)
  })
})
