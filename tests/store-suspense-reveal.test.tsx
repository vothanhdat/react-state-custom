// Runs on React's real scheduler, without act(): act() commits a resolved Suspense boundary at once,
// which hides React's throttled reveal (a resolved boundary commits 300 ms or more after its fallback).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Suspense, useEffect, useState, useTransition } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const waitFor = async (check: () => boolean, timeout = 2000) => {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('timed out')
    await sleep(10)
  }
}

let actEnvironment: unknown
beforeAll(() => {
  actEnvironment = (globalThis as any).IS_REACT_ACT_ENVIRONMENT
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false
})
afterAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = actEnvironment })

const makeUserStore = (name: string) => {
  const lifecycle = { mounts: 0 }
  const store = createStore(name, ({ id }: { id: string }) => {
    const [user, setUser] = useState<string>()
    useEffect(() => {
      lifecycle.mounts++
      const t = setTimeout(() => setUser('user-' + id), 30)
      return () => clearTimeout(t)
    }, [id])
    return { user }
  })
  return { ...store, lifecycle }
}

const mount = (element: React.ReactNode) => {
  const el = document.createElement('div')
  const root: Root = createRoot(el)
  root.render(element)
  return { el, unmount: async () => { root.unmount(); await sleep(20) } }
}

describe('useStoreSuspense with a throttled reveal', () => {
  it('keeps the store mounted until the resolved boundary commits', async () => {
    const { useStoreSuspense, lifecycle } = makeUserStore('reveal-hold')
    const Profile = () => {
      const { user } = useStoreSuspense({ id: 'a' }, s => !!s.user)
      return <b>{user}</b>
    }
    const { el, unmount } = mount(<><AutoRootCtx /><Suspense fallback={<i>loading</i>}><Profile /></Suspense></>)

    await waitFor(() => el.innerHTML === '<b>user-a</b>')
    await sleep(200)
    expect(el.innerHTML).toBe('<b>user-a</b>')
    expect(lifecycle.mounts).toBe(1)
    await unmount()
  })

  it('a param change inside startTransition keeps the previous content until the new instance is ready', async () => {
    const { useStoreSuspense } = makeUserStore('reveal-transition')
    let select!: (id: string) => void
    const Profile = ({ id }: { id: string }) => {
      const { user } = useStoreSuspense({ id }, s => !!s.user)
      return <b>{user}</b>
    }
    const App = () => {
      const [id, setId] = useState('a')
      const [, startTransition] = useTransition()
      select = next => startTransition(() => setId(next))
      return <Suspense fallback={<i>loading</i>}><Profile id={id} /></Suspense>
    }
    const { el, unmount } = mount(<><AutoRootCtx /><App /></>)
    await waitFor(() => el.innerHTML === '<b>user-a</b>')

    select('b')
    const seen = new Set<string>()
    await waitFor(() => { seen.add(el.innerHTML); return el.innerHTML === '<b>user-b</b>' })
    expect([...seen].filter(html => html.includes('loading'))).toEqual([])
    await unmount()
  })
})

describe('useStoreSuspense wait lease', () => {
  // The lease wakes a waiting component every 5 s. Here React retries it at once and it waits again,
  // taking its own retain before the previous one is released: the store keeps running throughout.
  it('hands the same instance over to a component still waiting', async () => {
    // fake setTimeout only: React schedules its work with setImmediate here, which keeps running
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const spin = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r)) }
    // let time pass in small steps, React running in between, as it would in a browser
    const elapse = async (ms: number) => {
      for (let left = ms; left > 0; left -= 100) { await vi.advanceTimersByTimeAsync(Math.min(100, left)); await spin() }
    }
    let root: Root | undefined
    try {
      let mounts = 0
      let setReady = (_: boolean) => { }
      const { useStoreSuspense } = createStore('reveal-lease', () => {
        const [ready, _setReady] = useState(false)
        setReady = _setReady
        useEffect(() => { mounts++ }, [])
        return { ready }
      })
      const Waiter = () => { useStoreSuspense({}, s => s.ready); return <b>ready</b> }
      const el = document.createElement('div')
      root = createRoot(el)
      root.render(<><AutoRootCtx /><Suspense fallback={<i>loading</i>}><Waiter /></Suspense></>)
      await spin()
      expect(mounts).toBe(1)

      // three leases: each wakes Waiter, which renders, is still not ready and waits again
      await elapse(3 * 5000 + 1000)
      expect(mounts).toBe(1)
      expect(el.innerHTML).toBe('<i>loading</i>')

      // React DOM throttles the reveal with the setTimeout it captured when it loaded: real time
      vi.useRealTimers()
      setReady(true)
      await waitFor(() => el.innerHTML === '<b>ready</b>')
      expect(mounts).toBe(1)
    } finally {
      vi.useRealTimers()
      root?.unmount()
      await sleep(20)
    }
  })
})
