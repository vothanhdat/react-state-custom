import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { createStore, AutoRootCtx } from '../src'
import { getContext } from '../src/state-utils/ctx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })
afterEach(() => vi.restoreAllMocks())

const makeCounter = (name: string, timeToClean = 0) => {
  const lifecycle = { mounts: 0, unmounts: 0 }
  const useCounter = ({ start = 0 }: { start?: number }) => {
    const [count, setCount] = useState(start)
    useEffect(() => {
      lifecycle.mounts++
      return () => { lifecycle.unmounts++ }
    }, [])
    return { count, increment: () => setCount(c => c + 1) }
  }
  const store = createStore(name, useCounter, { timeToClean })
  return { ...store, lifecycle }
}

describe('storeRef(params)', () => {
  it('get() returns {} before anything runs, then the live state; actions work from outside React', async () => {
    const { useStore, storeRef } = makeCounter('handle-basic')
    const handle = storeRef({ start: 5 })

    expect(handle.get()).toEqual({})
    expect(handle.ready).toBe(false)

    const C = () => <span data-testid="v">{useStore({ start: 5 }).count}</span>
    const { getByTestId } = render(<><AutoRootCtx /><C /></>)
    await tick()
    expect(handle.ready).toBe(true)
    expect(handle.get().count).toBe(5)

    // call a store action from plain JS
    await act(async () => { handle.get().increment!() })
    expect(getByTestId('v').textContent).toBe('6')
    expect(handle.get().count).toBe(6)
  })

  it('get() is one frozen object until the state changes, so it works as a useSyncExternalStore snapshot', async () => {
    const { storeRef } = makeCounter('handle-snapshot')
    const handle = storeRef()
    expect(handle.get()).toBe(storeRef().get()) // nothing runs the instance: the same empty state

    let renders = 0
    const Reader = () => {
      renders++
      const state = useSyncExternalStore(handle.subscribe, handle.get)
      return <span data-testid="v">{state.count ?? '-'}</span>
    }
    const release = handle.retain()
    const { getByTestId } = render(<><AutoRootCtx /><Reader /></>)
    await tick()
    expect(getByTestId('v').textContent).toBe('0')

    const before = handle.get()
    expect(handle.get()).toBe(before)
    expect(Object.isFrozen(before)).toBe(true)
    expect(() => { (before as { count?: number }).count = 5 }).toThrow(TypeError)

    await act(async () => { before.increment!() })
    expect(getByTestId('v').textContent).toBe('1')
    expect(handle.get()).not.toBe(before)
    expect(before.count).toBe(0) // a snapshot never changes
    expect(renders).toBeLessThan(10) // a new object per call made React render until it gave up
    release()
  })

  it('subscribe() delivers every change with the changed key and stops after unsubscribe', async () => {
    const { useStore, storeRef } = makeCounter('handle-subscribe')
    const handle = storeRef()
    const seen: Array<[number | undefined, string]> = []
    const unsub = handle.subscribe((state, key) => seen.push([state.count, String(key)]))

    const C = () => { useStore(); return null }
    render(<><AutoRootCtx /><C /></>)
    await tick()
    expect(seen.some(([count, key]) => key === 'count' && count === 0)).toBe(true)

    seen.length = 0
    await act(async () => { handle.get().increment!() })
    expect(seen).toContainEqual([1, 'count'])

    unsub()
    await act(async () => { handle.get().increment!() })
    expect(seen).toEqual([[1, 'count']])
  })

  it('retain() runs the store with no React consumer and tears it down on release', async () => {
    const { storeRef, lifecycle } = makeCounter('handle-retain')
    render(<AutoRootCtx />)
    const handle = storeRef({ start: 10 })

    const release = handle.retain()
    await tick()
    expect(handle.ready).toBe(true)
    expect(handle.get().count).toBe(10)
    expect(lifecycle.mounts - lifecycle.unmounts).toBe(1)

    await act(async () => { handle.get().increment!() })
    expect(handle.get().count).toBe(11)

    await act(async () => { release() }) // flush the store unmount
    await tick(250) // context eviction delay
    expect(lifecycle.mounts - lifecycle.unmounts).toBe(0)
    expect(getContext.fromCache(handle.name)).toBeUndefined()
    expect(handle.ready).toBe(false)
    expect(handle.get()).toEqual({})
  })

  it('a retained store is shared with components that mount later, and survives their unmount', async () => {
    const { useStore, storeRef, lifecycle } = makeCounter('handle-shared')
    render(<AutoRootCtx />)
    const handle = storeRef()
    const release = handle.retain()
    await tick()
    await act(async () => { handle.get().increment!() })

    const C = () => <span data-testid="v">{useStore().count}</span>
    const view = render(<C />)
    await tick()
    expect(view.getByTestId('v').textContent).toBe('1') // same instance, not a fresh one
    view.unmount()
    await tick(250)
    expect(lifecycle.mounts - lifecycle.unmounts).toBe(1) // still retained
    expect(handle.get().count).toBe(1)
    release()
  })
})
