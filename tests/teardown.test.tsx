// What is left of a store instance once it is torn down: its actions do nothing and leave the context,
// which is evicted at once instead of staying cached for 100 ms.
import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })
const Activity = (React as any).Activity as React.ComponentType<{ mode: 'visible' | 'hidden', children?: React.ReactNode }> | undefined

/** A store whose action records whether the instance that runs it is still mounted. */
const makeLoader = (name: string) => {
  const calls: string[] = []
  const { useStore } = createStore(name, () => {
    const live = useRef(false)
    useEffect(() => {
      live.current = true
      return () => { live.current = false }
    }, [])
    const load = () => { calls.push(live.current ? 'live' : 'dead') }
    return { load }
  })
  // loads on mount, and again once the action exists: the pattern the docs recommend
  const Reader = () => {
    const { load } = useStore()
    useEffect(() => { load?.() }, [load])
    return null
  }
  return { calls, Reader }
}

describe('a torn-down store instance', () => {
  it('never runs its actions for a component that mounts right after', async () => {
    const { calls, Reader } = makeLoader('teardown-remount')
    const r = render(<><AutoRootCtx /><Reader /></>)
    await tick()
    expect(calls).toEqual(['live'])
    r.rerender(<AutoRootCtx />)                    // the last reader leaves: the instance is torn down
    await tick(10)
    r.rerender(<><AutoRootCtx /><Reader /></>)     // up to 1.6, this reader got the dead instance's `load`
    await tick()
    expect(calls).toEqual(['live', 'live'])
  })

  it('keeps the instance when one reader unmounts as another mounts, in one commit', async () => {
    const { useStore, getStore } = createStore('teardown-swap', () => {
      const [n, setN] = useState(0)
      return { n, setN }
    })
    const View = () => <span>{useStore().n}</span>
    const r = render(<><AutoRootCtx /><View key="a" /></>)
    await tick()
    act(() => getStore().get().setN!(5))
    await tick()
    r.rerender(<><AutoRootCtx /><View key="b" /></>)
    await tick()
    expect(getStore().get().n).toBe(5)
  })

  it('does nothing when an action of a failed instance is called', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    const effects: string[] = []
    const { useStore, getStore } = createStore('teardown-failed', () => {
      const [boom, setBoom] = useState(false)
      useEffect(() => { if (boom) throw new Error('bug in effect') }, [boom])
      return { boom, crash: () => setBoom(true), ping: () => { effects.push('ping') } }
    })
    const View = () => <span>{String(useStore().boom)}</span>
    render(<><AutoRootCtx /><View /></>)
    await tick()
    const { ping, crash } = getStore().get()
    act(() => crash!())
    await tick()
    ping!()
    expect(effects).toEqual([])
    expect(getStore().get().boom).toBe(true)       // its last values stay for its readers
  })
})

describe.skipIf(!Activity)('a store torn down while its readers are hidden in <Activity>', () => {
  it('runs only the next instance\'s actions when they are shown again', async () => {
    const { calls, Reader } = makeLoader('teardown-activity')
    let setVisible: (visible: boolean) => void = () => { }
    const App = () => {
      const [visible, set] = useState(true)
      setVisible = set
      const Hideable = Activity!
      return <Hideable mode={visible ? 'visible' : 'hidden'}><Reader /></Hideable>
    }
    render(<><AutoRootCtx /><App /></>)
    await tick()
    expect(calls).toEqual(['live'])
    act(() => setVisible(false))                   // effects cleaned up: the instance is torn down
    await tick(200)
    act(() => setVisible(true))                    // the effect runs again with the `load` it rendered with
    await tick()
    expect(calls).toEqual(['live', 'live'])
  })
})
