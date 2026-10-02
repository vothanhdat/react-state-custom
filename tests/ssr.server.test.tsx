/** @vitest-environment node */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { createStore, AutoRootCtx, StateScopeProvider } from '../src/state-utils/createAutoCtx'
import { getContext } from '../src/state-utils/ctx'

describe('server rendering (node environment, no DOM)', () => {
  it('renders initialState, never runs store hooks, and leaves the shared cache empty', () => {
    expect(typeof window).toBe('undefined')
    let storeRuns = 0
    const { useStore } = createStore('ssr-user', ({ userId }: { userId: string }) => {
      storeRuns++
      return { user: { id: userId, name: 'Ada' }, isLoading: false }
    }, { initialState: { user: null as null | { id: string, name: string }, isLoading: true } })

    const Profile = ({ userId }: { userId: string }) => {
      const { user, isLoading } = useStore({ userId })
      return <p>{isLoading ? 'loading' : user!.name}</p>
    }
    const App = () => <><AutoRootCtx /><Profile userId="u1" /><Profile userId="u2" /></>

    const html = renderToString(<App />)
    expect(html).toContain('<p>loading</p><p>loading</p>')
    expect(storeRuns).toBe(0)
    expect(getContext.cache.size).toBe(0)

    // many requests with many params: still nothing retained
    for (let i = 0; i < 50; i++) renderToString(<><AutoRootCtx /><Profile userId={'req' + i} /></>)
    expect(getContext.cache.size).toBe(0)
  })

  it('works inside StateScopeProvider and without any AutoRootCtx', () => {
    const { useStore } = createStore('ssr-plain', (_: {}) => ({ v: 1 }), { initialState: { v: 0 } })
    const C = () => <i>{useStore().v}</i>
    expect(renderToString(<StateScopeProvider><C /></StateScopeProvider>)).toContain('<i>0</i>')
    expect(renderToString(<C />)).toContain('<i>0</i>')
    expect(getContext.cache.size).toBe(0)
  })
})
