// Runs on React's real scheduler, without act(): see store-suspense-reveal.test.tsx
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Suspense, use, useState } from 'react'
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
  it('suspends only itself: the app stays visible and consumers wait in their own boundaries', async () => {
    const data = deferred<string>()
    const { useStore, useStoreSuspense } = createStore('hook-suspends-mount', () => ({ value: use(data.promise) }))
    const Plain = () => { const { value } = useStore(); return <b>plain:{value ?? '…'}</b> }
    const Waiting = () => { const { value } = useStoreSuspense(); return <b>waiting:{value}</b> }
    const { el, root } = mount(
      <Suspense fallback={<i>app-fallback</i>}>
        <AutoRootCtx />
        <span>other</span>
        <Plain />
        <Suspense fallback={<i>local-fallback</i>}><Waiting /></Suspense>
      </Suspense>
    )
    await sleep(50)
    expect(el.innerHTML).toBe('<span>other</span><b>plain:…</b><i>local-fallback</i>')

    data.resolve('done')
    await waitFor(() => el.textContent === 'otherplain:donewaiting:done')
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
