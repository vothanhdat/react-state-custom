import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { useState } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'
import { getContext } from '../src/state-utils/ctx'
import { DevToolContainer } from '../src/dev-tool'

let root: Root | undefined
afterEach(() => { if (root) act(() => root!.unmount()); root = undefined; vi.restoreAllMocks() })

describe('hydration', () => {
  it('server HTML equals the client first render; stores fill in after hydration without mismatch', async () => {
    const { useStore } = createStore('hyd-user', ({ userId }: { userId: string }) => {
      const [user] = useState({ id: userId, name: 'Ada' })
      return { user, isLoading: false }
    }, { initialState: { user: null as null | { id: string, name: string }, isLoading: true } })

    const Profile = () => {
      const { user, isLoading } = useStore({ userId: 'u1' })
      return <p>{isLoading ? 'loading' : user!.name}</p>
    }
    const App = () => <><AutoRootCtx /><Profile /></>

    // "server": produce HTML, then forget everything as a fresh browser would
    const html = renderToString(<App />)
    expect(html).toContain('loading')
    getContext.cache.clear()

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => { root = hydrateRoot(container, <App />) })
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })

    const hydrationComplaints = errors.mock.calls.filter(c => /hydrat|did not match|mismatch/i.test(c.map(String).join(' ')))
    expect(hydrationComplaints).toEqual([])
    expect(container.textContent).toBe('Ada')
    container.remove()
  })

  it('hydrates the dev tool as the server rendered it, then restores what this tab remembered', async () => {
    const html = renderToString(<DevToolContainer />)
    expect(html).not.toContain('react-state-custom stores')
    // this tab had the panel open at 420 px: the server cannot know
    sessionStorage.setItem('react-state-custom:dev-tool:open', 'true')
    sessionStorage.setItem('react-state-custom:dev-tool:height', '420')

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => { root = hydrateRoot(container, <DevToolContainer />) })

    const hydrationComplaints = errors.mock.calls.filter(c => /hydrat|did not match|mismatch/i.test(c.map(String).join(' ')))
    expect(hydrationComplaints).toEqual([])
    expect(container.querySelector<HTMLElement>('[aria-label="react-state-custom stores"]')?.style.height).toBe('420px')
    sessionStorage.clear()
    container.remove()
  })
})
