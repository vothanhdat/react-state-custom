import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { useState } from 'react'
import { createStore, useMultipleStore, AutoRootCtx } from '../src'
import { getContext } from '../src/state-utils/ctx'
import { DevToolContainer } from '../src/dev-tool'

let root: Root | undefined
afterEach(() => { if (root) act(() => root!.unmount()); root = undefined; vi.restoreAllMocks() })

describe('hydration', () => {
  it('server HTML equals the client first render; stores fill in after hydration without mismatch', async () => {
    const { useStore } = createStore('hyd-user', ({ userId }: { userId: string }) => {
      const [user] = useState({ id: userId, name: 'Ada' })
      return { user, isLoading: false }
    })

    const Profile = () => {
      const { user, isLoading = true } = useStore({ userId: 'u1' })
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

  it('useMultipleStore hydrates what the server rendered although the instances already run, then the live data', async () => {
    const { storeRef } = createStore('hyd-multi', ({ id }: { id: string }) => ({ label: id.toUpperCase() }))
    const refs = () => [storeRef({ id: 'a' }), storeRef({ id: 'b' })]
    const Labels = () => <p>{useMultipleStore(refs()).map(item => item.label ?? '…').join(',')}</p>
    const Count = () => <i>{useMultipleStore(refs(), { select: items => items.filter(item => item.label).length })}</i>
    const App = () => <><Labels /><Count /></>

    const html = renderToString(<App />)
    expect(html).toContain('<p>…,…</p><i>0</i>')
    getContext.cache.clear()

    // the instances started in another root of the page before this one hydrates
    const other = document.createElement('div')
    const otherRoot = createRoot(other)
    await act(async () => { otherRoot.render(<AutoRootCtx />) })
    const releases: (() => void)[] = []
    await act(async () => { for (const ref of refs()) releases.push(ref.retain()) })
    expect(storeRef({ id: 'a' }).get().label).toBe('A')

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => { root = hydrateRoot(container, <App />) })
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })

    const hydrationComplaints = errors.mock.calls.filter(c => /hydrat|did not match|mismatch/i.test(c.map(String).join(' ')))
    expect(hydrationComplaints).toEqual([])
    expect(container.textContent).toBe('A,B2')
    act(() => { releases.forEach(release => release()); otherRoot.unmount() })
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
