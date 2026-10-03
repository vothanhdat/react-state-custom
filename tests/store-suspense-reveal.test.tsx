// Runs on React's real scheduler, without act(): act() commits a resolved Suspense boundary at once,
// which hides React's throttled reveal (a resolved boundary commits 300 ms or more after its fallback).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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
