/** @vitest-environment node */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { createStore, AutoRootCtx, StateScopeProvider } from '../src/state-utils/createAutoCtx'
import { useMultipleStore } from '../src/state-utils/useMultipleStore'
import { getContext } from '../src/state-utils/ctx'
import { DevToolContainer } from '../src/dev-tool'

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

  it('renders useMultipleStore from empty states, never running the stores', () => {
    let storeRuns = 0
    const { storeRef } = createStore('ssr-multi', ({ id }: { id: string }) => {
      storeRuns++
      return { label: id }
    })
    const refs = () => ['a', 'b'].map(id => storeRef({ id }))
    const Labels = () => <p>{useMultipleStore(refs()).map(item => item.label ?? '…').join(',')}</p>
    const Count = () => <i>{useMultipleStore(refs(), { select: items => items.filter(item => item.label).length })}</i>
    expect(renderToString(<><AutoRootCtx /><Labels /><Count /></>)).toContain('<p>…,…</p><i>0</i>')
    expect(storeRuns).toBe(0)
    expect(getContext.cache.size).toBe(0)
  })

  it('works inside StateScopeProvider and without any AutoRootCtx', () => {
    const { useStore } = createStore('ssr-plain', (_: {}) => ({ v: 1 }), { initialState: { v: 0 } })
    const C = () => <i>{useStore().v}</i>
    expect(renderToString(<StateScopeProvider><C /></StateScopeProvider>)).toContain('<i>0</i>')
    expect(renderToString(<C />)).toContain('<i>0</i>')
    expect(getContext.cache.size).toBe(0)
  })

  it('renders an initially open dev tool, at a fixed height until the viewport is known', () => {
    const html = renderToString(<DevToolContainer defaultOpen />)
    expect(html).toContain('aria-label="react-state-custom stores"')
    expect(html).toContain('height:300px')
  })

  it('reports a store as not ready and not failed on the server', () => {
    const { useStoreStatus } = createStore('ssr-status', (): { v: number } => { throw new Error('never runs on the server') })
    const Status = () => { const { ready, failed } = useStoreStatus(); return <i>{`${ready}/${failed}`}</i> }
    expect(renderToString(<><AutoRootCtx /><Status /></>)).toContain('false/false')
  })
})
