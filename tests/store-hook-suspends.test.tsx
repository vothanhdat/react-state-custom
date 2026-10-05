// Runs on React's real scheduler, without act(): see store-suspense-reveal.test.tsx
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as React from 'react'
import { Suspense, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createStore, AutoRootCtx } from '../src'

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

const settled = new WeakMap<Promise<unknown>, { value: unknown }>()

/** React 19's `use(promise)`; on React 18, which has no `use`, the older form: throw the pending promise. */
const use: <T>(promise: Promise<T>) => T = (React as any).use ?? (<T,>(promise: Promise<T>): T => {
  const result = settled.get(promise)
  if (result) return result.value as T
  throw promise.then(value => { settled.set(promise, { value }) })
})

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

const mount = (element: React.ReactNode) => {
  const el = document.createElement('div')
  const root: Root = createRoot(el)
  root.render(element)
  return { el, root }
}

describe('a store hook that suspends', () => {
  it('suspends only itself: the app stays visible and readers render their loading state', async () => {
    const data = deferred<string>()
    const { useStore } = createStore('hook-suspends-mount', () => ({ value: use(data.promise) }))
    const Plain = () => { const { value } = useStore(); return <b>plain:{value ?? '…'}</b> }
    const { el, root } = mount(
      <Suspense fallback={<i>app-fallback</i>}>
        <AutoRootCtx />
        <span>other</span>
        <Plain />
      </Suspense>
    )
    await sleep(50)
    expect(el.innerHTML).toBe('<span>other</span><b>plain:…</b>')

    data.resolve('done')
    await waitFor(() => el.textContent === 'otherplain:done')
    root.unmount()
  })

  it('keeps its last published values while it suspends again on an update', async () => {
    const first = deferred<string>()
    const next = deferred<string>()
    let load: (p: Promise<string>) => void = () => { }
    const { useStore } = createStore('hook-suspends-update', () => {
      const [request, setRequest] = useState(first.promise)
      load = setRequest
      return { value: use(request) }
    })
    const Plain = () => { const { value } = useStore(); return <b>{value ?? '…'}</b> }
    const { el, root } = mount(<Suspense fallback={<i>app-fallback</i>}><AutoRootCtx /><span>other</span><Plain /></Suspense>)
    first.resolve('one')
    await waitFor(() => el.innerHTML === '<span>other</span><b>one</b>')

    load(next.promise)
    await sleep(50)
    expect(el.innerHTML).toBe('<span>other</span><b>one</b>')

    next.resolve('two')
    await waitFor(() => el.innerHTML === '<span>other</span><b>two</b>')
    root.unmount()
  })

  // 1.x only: removed in 2.0
  it('an AttachedComponent that suspends does not hide the app either', async () => {
    const data = deferred<string>()
    const Attached = () => { use(data.promise); return null }
    const { useStore } = createStore('hook-suspends-attached', () => ({ value: 'ran' }), { AttachedComponent: Attached })
    const Plain = () => { const { value } = useStore(); return <b>{value ?? '…'}</b> }
    const { el, root } = mount(<Suspense fallback={<i>app-fallback</i>}><AutoRootCtx /><Plain /></Suspense>)
    await waitFor(() => el.innerHTML === '<b>ran</b>')
    data.resolve('x')
    root.unmount()
  })
})
