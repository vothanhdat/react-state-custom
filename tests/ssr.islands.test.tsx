// Runs on React's real scheduler, without act(): hydration errors are reported through
// onRecoverableError, and each island hydrates in its own task like on a real page.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { hydrateRoot, type Root } from 'react-dom/client'
import { useState } from 'react'
import { createStore, AutoRootCtx, StateScopeProvider } from '../src/state-utils/createAutoCtx'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

let actEnvironment: unknown
beforeAll(() => {
  actEnvironment = (globalThis as any).IS_REACT_ACT_ENVIRONMENT
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false
})
afterAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = actEnvironment })

/** A container holding the HTML the server rendered from initialState. */
const island = (html: string) => {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

const hydrateAll = async (parts: [HTMLElement, React.ReactNode][]) => {
  const errors: string[] = []
  const roots: Root[] = []
  for (const [el, node] of parts) {
    roots.push(hydrateRoot(el, node, { onRecoverableError: e => errors.push(String((e as Error)?.message ?? e)) }))
    await sleep(50)   // the store runs and publishes before the next island hydrates
  }
  return { errors, unmount: () => roots.forEach(r => r.unmount()) }
}

describe('hydrating after a store has already published', () => {
  it('a useStore consumer hydrates against the server HTML, then shows the live value', async () => {
    const { useStore } = createStore('islands-proxy', () => ({ theme: 'dark' }), { initialState: { theme: 'light' } })
    const Theme = () => { const { theme } = useStore(); return <span>{theme}</span> }
    const a = island('<span>light</span>')
    const b = island('<span>light</span>')
    const { errors, unmount } = await hydrateAll([[a, <><AutoRootCtx /><Theme /></>], [b, <Theme />]])
    expect(errors).toEqual([])
    expect(a.innerHTML).toBe('<span>dark</span>')
    expect(b.innerHTML).toBe('<span>dark</span>')
    unmount()
  })

  it('a selector consumer hydrates against the server HTML, then shows the live value', async () => {
    const { useStore } = createStore('islands-selector', () => ({ count: 5 }), { initialState: { count: 0 } })
    const Count = () => { const label = useStore(undefined, s => `n=${s.count}`); return <span>{label}</span> }
    const a = island('<span>n=0</span>')
    const b = island('<span>n=0</span>')
    const { errors, unmount } = await hydrateAll([[a, <><AutoRootCtx /><Count /></>], [b, <Count />]])
    expect(errors).toEqual([])
    expect(b.innerHTML).toBe('<span>n=5</span>')
    unmount()
  })

  it('a store without initialState hydrates against the empty server render', async () => {
    const { useStore } = createStore('islands-no-seed', () => ({ name: 'Ada' }))
    const Name = () => { const { name } = useStore(); return <span>{name ?? '…'}</span> }
    const a = island('<span>…</span>')
    const b = island('<span>…</span>')
    const { errors, unmount } = await hydrateAll([[a, <><AutoRootCtx /><Name /></>], [b, <Name />]])
    expect(errors).toEqual([])
    expect(b.innerHTML).toBe('<span>Ada</span>')
    unmount()
  })

  it('a component hydrating before its store ran renders once when the first result equals initialState', async () => {
    const { useStore } = createStore('islands-no-extra', () => ({ theme: 'light' }), { initialState: { theme: 'light' } })
    let renders = 0
    const Theme = () => { renders++; const { theme } = useStore(); return <span>{theme}</span> }
    const a = island('<span>light</span>')
    const { errors, unmount } = await hydrateAll([[a, <><AutoRootCtx /><Theme /></>]])
    expect(errors).toEqual([])
    expect(renders).toBe(1)
    unmount()
  })
})

describe('islands with their own scope', () => {
  it('two hydrated islands, each in a StateScopeProvider, keep separate stores', async () => {
    // Hydrated roots number useId by tree position, so both scopes got the same id and shared their
    // stores: two AutoRootCtx in one scope, and the store mounted twice was disabled.
    const { useStore } = createStore('islands-scoped', () => {
      const [n, setN] = useState(0)
      return { n, inc: () => setN(x => x + 1) }
    }, { initialState: { n: 0 } })
    const Counter = () => {
      const { n, inc } = useStore()
      return <button onClick={() => inc?.()}>{n}</button>
    }
    const app = <StateScopeProvider><Counter /></StateScopeProvider>
    const a = island('<button>0</button>')
    const b = island('<button>0</button>')
    const consoleErrors = vi.spyOn(console, 'error').mockImplementation(() => { })
    try {
      const { errors, unmount } = await hydrateAll([[a, app], [b, app]])
      a.querySelector('button')!.click()
      await sleep(50)
      expect(errors).toEqual([])
      expect(consoleErrors).not.toHaveBeenCalled()
      expect(a.textContent).toBe('1')
      expect(b.textContent).toBe('0')
      unmount()
    } finally {
      consoleErrors.mockRestore()
    }
  })
})
