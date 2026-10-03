import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { Suspense, useEffect, useState } from 'react'
import { createStore, AutoRootCtx, StateScopeProvider } from '../src/state-utils/createAutoCtx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })
afterEach(async () => {
  vi.restoreAllMocks()
  // A retain taken while suspended is released when the component commits (at once under act()), or by
  // a 1 s safety timer when it never does. Let pending store work settle while the environment is up;
  // under coverage a late AutoRootCtx update otherwise outlives the jsdom window and throws.
  await act(() => new Promise(resolve => setTimeout(resolve, 150)))
})

// Counts how often the fallback rendered: > 0 means the child suspended at least once.
const makeFallback = () => {
  const counter = { renders: 0 }
  const Fallback = () => { counter.renders++; return <i data-testid="fb" /> }
  return { counter, Fallback }
}

const makeUserStore = (name: string, delay: number) => {
  const lifecycle = { mounts: 0, unmounts: 0 }
  const useUser = ({ id }: { id: string }) => {
    const [user, setUser] = useState<{ id: string, name: string } | null>(null)
    useEffect(() => {
      lifecycle.mounts++
      const t = setTimeout(() => setUser({ id, name: 'User ' + id }), delay)
      return () => { lifecycle.unmounts++; clearTimeout(t) }
    }, [id])
    return { user, isLoading: !user, rename: (n: string) => setUser(u => u && { ...u, name: n }) }
  }
  return { ...createStore(name, useUser), lifecycle }
}

describe('useStoreSuspense', () => {
  it('shows the fallback until the store hook has run, then renders fully typed state', async () => {
    const { useStoreSuspense, lifecycle } = makeUserStore('suspense-basic', 0)
    const Profile = () => {
      const { isLoading } = useStoreSuspense({ id: '1' })
      // typed as boolean, not boolean | undefined
      const flag: boolean = isLoading
      return <span data-testid="out">{flag ? 'loading' : 'ran'}</span>
    }
    const { counter, Fallback } = makeFallback()
    const { getByTestId, queryByTestId } = render(
      <><AutoRootCtx /><Suspense fallback={<Fallback />}><Profile /></Suspense></>
    )
    await tick(50)
    expect(counter.renders).toBeGreaterThan(0)
    expect(queryByTestId('fb')).toBeNull()
    expect(getByTestId('out').textContent).toBe('ran')
    expect(lifecycle.mounts - lifecycle.unmounts).toBe(1)
  })

  it('with isReady, suspends until the predicate holds and keeps updating afterwards', async () => {
    const { useStoreSuspense, getStore, lifecycle } = makeUserStore('suspense-ready', 60)
    const Profile = () => {
      const { user, rename } = useStoreSuspense({ id: '7' }, s => !!s.user)
      return <button data-testid="name" onClick={() => rename('Renamed')}>{user!.name}</button>
    }
    const { getByTestId, queryByTestId } = render(
      <><AutoRootCtx /><Suspense fallback={<i data-testid="fb" />}><Profile /></Suspense></>
    )
    await tick(20)
    expect(queryByTestId('fb')).not.toBeNull() // hook ran but still loading
    await tick(100)
    expect(getByTestId('name').textContent).toBe('User 7')

    await act(async () => { getByTestId('name').click() })
    expect(getByTestId('name').textContent).toBe('Renamed')

    // the imperative retain has been released by now; the component keeps the single instance alive
    await tick(200)
    expect(lifecycle.mounts - lifecycle.unmounts).toBe(1)
    expect(getStore({ id: '7' }).get().user?.name).toBe('Renamed')
  })

  it('works inside a StateScopeProvider (scoped root, scoped context)', async () => {
    const { useStoreSuspense } = makeUserStore('suspense-scoped', 0)
    const Profile = () => <span data-testid="out">{useStoreSuspense({ id: 's' }, s => !!s.user).user!.name}</span>
    const { getByTestId } = render(
      <StateScopeProvider>
        <Suspense fallback={<i />}><Profile /></Suspense>
      </StateScopeProvider>
    )
    await tick(20)
    await tick(60)
    expect(getByTestId('out').textContent).toBe('User s')
  })

  it('does not suspend when initialState already satisfies isReady', () => {
    const { useStoreSuspense } = createStore('suspense-seeded', (_: {}) => ({ n: 1 }), { initialState: { n: 0 } })
    const C = () => <span data-testid="n">{useStoreSuspense(undefined, s => typeof s.n === 'number').n}</span>
    const { counter, Fallback } = makeFallback()
    const { getByTestId } = render(<><AutoRootCtx /><Suspense fallback={<Fallback />}><C /></Suspense></>)
    expect(counter.renders).toBe(0)
    expect(['0', '1']).toContain(getByTestId('n').textContent)
  })

  it('suspends only on first load: a refetch turning isReady false again keeps the content', async () => {
    let setLoading: (v: boolean) => void = () => { }
    let setData: (v: string) => void = () => { }
    const { useStoreSuspense } = createStore('suspense-first-load-only', () => {
      const [isLoading, _setLoading] = useState(false)
      const [data, _setData] = useState('x')
      setLoading = _setLoading
      setData = _setData
      return { isLoading, data }
    })
    const View = () => {
      const { data, isLoading } = useStoreSuspense(undefined, s => !s.isLoading)
      return <span data-testid="v">{data}{isLoading ? ' (refreshing)' : ''}</span>
    }
    const { counter, Fallback } = makeFallback()
    const { getByTestId, queryByTestId } = render(
      <><AutoRootCtx /><Suspense fallback={<Fallback />}><View /></Suspense></>
    )
    await tick(50)
    expect(getByTestId('v').textContent).toBe('x')
    const fallbacks = counter.renders

    act(() => { setLoading(true); setData('y') })
    await tick()
    expect(queryByTestId('fb')).toBeNull()
    expect(counter.renders).toBe(fallbacks)
    expect(getByTestId('v').textContent).toBe('y (refreshing)')
  })
})

