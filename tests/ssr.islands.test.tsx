// Runs on React's real scheduler, without act(): hydration errors are reported through
// onRecoverableError, and each island hydrates in its own task like on a real page.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hydrateRoot, type Root } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { createStore, AutoRootCtx } from '../src'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

let actEnvironment: unknown
beforeAll(() => {
  actEnvironment = (globalThis as any).IS_REACT_ACT_ENVIRONMENT
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false
})
afterAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = actEnvironment })

/** A container holding the HTML the server rendered. */
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
    const { useStore } = createStore('islands-proxy', () => ({ theme: 'dark' }))
    const Theme = () => { const { theme = 'light' } = useStore(); return <span>{theme}</span> }
    const a = island('<span>light</span>')
    const b = island('<span>light</span>')
    const { errors, unmount } = await hydrateAll([[a, <><AutoRootCtx /><Theme /></>], [b, <Theme />]])
    expect(errors).toEqual([])
    expect(a.innerHTML).toBe('<span>dark</span>')
    expect(b.innerHTML).toBe('<span>dark</span>')
    unmount()
  })

  it('a selector consumer hydrates against the server HTML, then shows the live value', async () => {
    const { useStore } = createStore('islands-selector', () => ({ count: 5 }))
    const Count = () => { const label = useStore(undefined, { select: s => `n=${s.count ?? 0}` }); return <span>{label}</span> }
    const a = island('<span>n=0</span>')
    const b = island('<span>n=0</span>')
    const { errors, unmount } = await hydrateAll([[a, <><AutoRootCtx /><Count /></>], [b, <Count />]])
    expect(errors).toEqual([])
    expect(b.innerHTML).toBe('<span>n=5</span>')
    unmount()
  })

  it('a store whose values went back to undefined hydrates in one render: it matches the server', async () => {
    const { useStore } = createStore('islands-undefined', () => {
      const [name, setName] = useState<string | undefined>('Ada')
      useEffect(() => { setName(undefined) }, [])
      return { name }
    })
    let renders = 0
    const Name = ({ count }: { count?: boolean }) => { if (count) renders++; const { name } = useStore(); return <span>{name ?? '…'}</span> }
    const a = island('<span>…</span>')
    const b = island('<span>…</span>')
    const { errors, unmount } = await hydrateAll([[a, <><AutoRootCtx /><Name /></>], [b, <Name count />]])
    expect(errors).toEqual([])
    expect(b.innerHTML).toBe('<span>…</span>')
    expect(renders).toBe(1)
    unmount()
  })

  it('a value the store has not published hydrates as undefined', async () => {
    const { useStore } = createStore('islands-no-seed', () => ({ name: 'Ada' }))
    const Name = () => { const { name } = useStore(); return <span>{name ?? '…'}</span> }
    const a = island('<span>…</span>')
    const b = island('<span>…</span>')
    const { errors, unmount } = await hydrateAll([[a, <><AutoRootCtx /><Name /></>], [b, <Name />]])
    expect(errors).toEqual([])
    expect(b.innerHTML).toBe('<span>Ada</span>')
    unmount()
  })
})
