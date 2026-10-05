import { describe, it, expect } from 'vitest'
import { render, act, screen } from '@testing-library/react'
import { Profiler, useState, type ReactNode } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

/** A store whose `id` tells instances apart: a remount gets a new id. */
const instanceStore = (name: string, timeToClean = 0) => {
  let next = 0
  return createStore(name, () => {
    const [id] = useState(() => ++next)
    return { id }
  }, timeToClean)
}

describe('AutoRootCtx reference counting', () => {
  it('a consumer joining or leaving a running instance does not re-render AutoRootCtx', async () => {
    const { useStore } = instanceStore('refcount-join')
    let autoCommits = 0
    const Reader = () => <i>{useStore().id}</i>
    let setExtra!: (show: boolean) => void
    // the toggle lives in its own component so AutoRootCtx's parent never re-renders
    const Extra = () => { const [show, set] = useState(false); setExtra = set; return show ? <Reader /> : null }
    render(<>
      <Profiler id="auto" onRender={() => autoCommits++}><AutoRootCtx /></Profiler>
      <Reader />
      <Extra />
    </>)
    await tick()
    autoCommits = 0
    act(() => setExtra(true))
    await tick()
    act(() => setExtra(false))
    await tick()
    expect(autoCommits).toBe(0)
  })

  it('timeToClean keeps the instance for a consumer that comes back in time, and tears it down after', async () => {
    const { useStore } = instanceStore('refcount-keep', 100)
    const Reader = () => <b data-testid="id">{useStore().id}</b>
    const App = ({ show }: { show: boolean }) => <><AutoRootCtx />{show && <Reader />}</>
    const { rerender } = render(<App show={true} />)
    await tick()
    const first = screen.getByTestId('id').textContent

    rerender(<App show={false} />)
    await tick(50)
    rerender(<App show={true} />)
    await tick()
    expect(screen.getByTestId('id').textContent).toBe(first)

    rerender(<App show={false} />)
    await tick(150)
    rerender(<App show={true} />)
    await tick()
    expect(screen.getByTestId('id').textContent).not.toBe(first)
  })

  it('timeToClean: Infinity keeps the instance for good (a timer that long used to fire at once)', async () => {
    const { useStore } = instanceStore('refcount-forever', Infinity)
    const Reader = () => <b data-testid="id">{useStore().id}</b>
    const App = ({ show }: { show: boolean }) => <><AutoRootCtx />{show && <Reader />}</>
    const { rerender } = render(<App show={true} />)
    await tick()
    const first = screen.getByTestId('id').textContent

    rerender(<App show={false} />)
    await tick(50)
    rerender(<App show={true} />)
    await tick()
    expect(screen.getByTestId('id').textContent).toBe(first)
  })

  it('without timeToClean the instance stops with its last consumer and a new one starts fresh', async () => {
    const { useStore } = instanceStore('refcount-drop')
    const Reader = () => <b data-testid="id">{useStore().id}</b>
    const App = ({ show }: { show: boolean }) => <><AutoRootCtx />{show && <Reader />}</>
    const { rerender } = render(<App show={true} />)
    await tick()
    const first = screen.getByTestId('id').textContent
    rerender(<App show={false} />)
    await tick()
    rerender(<App show={true} />)
    await tick()
    expect(screen.getByTestId('id').textContent).not.toBe(first)
  })

  it('a retain keeps the instance after every consumer is gone', async () => {
    const { useStore, getStore } = instanceStore('refcount-retain')
    const Reader = () => <b data-testid="id">{useStore().id}</b>
    const App = ({ show }: { show: boolean }) => <><AutoRootCtx />{show && <Reader />}</>
    const { rerender } = render(<App show={true} />)
    await tick()
    const first = screen.getByTestId('id').textContent
    const release = getStore().retain()
    rerender(<App show={false} />)
    await tick()
    expect(getStore().get().id).toBe(Number(first))
    rerender(<App show={true} />)
    await tick()
    expect(screen.getByTestId('id').textContent).toBe(first)
    act(() => release())
  })

  it('calling a release twice counts once', async () => {
    const { useStore, getStore } = instanceStore('refcount-double-release')
    const Reader = () => <b data-testid="id">{useStore().id}</b>
    render(<><AutoRootCtx /><Reader /></>)
    await tick()
    const first = screen.getByTestId('id').textContent
    const release = getStore().retain()
    await tick()
    act(() => { release(); release() })
    await tick()
    // the component's own subscription still holds the instance
    expect(screen.getByTestId('id').textContent).toBe(first)
  })

  it('starting an instance re-renders only a share of the running instances', async () => {
    const { useStore } = createStore('refcount-buckets', ({ id }: { id: number }) => ({ id }))
    let wrapperRenders = 0
    const CountingWrapper = ({ children }: { children?: ReactNode }) => { wrapperRenders++; return <>{children}</> }
    const Row = ({ id }: { id: number }) => <i>{useStore({ id }).id}</i>
    let setExtra!: (show: boolean) => void
    const Extra = () => { const [show, set] = useState(false); setExtra = set; return show ? <Row id={-1} /> : null }
    render(<>
      <AutoRootCtx Wrapper={CountingWrapper} />
      {Array.from({ length: 640 }, (_, i) => <Row key={i} id={i} />)}
      <Extra />
    </>)
    await tick()
    wrapperRenders = 0
    act(() => setExtra(true))
    await tick()
    // one bucket of ~10 instances re-renders (twice under StrictMode), not all 640
    expect(wrapperRenders).toBeGreaterThan(0)
    expect(wrapperRenders).toBeLessThan(100)
  })
})

/**
 * The displayNames of the components rendered under `container`, depth-first: what React DevTools
 * shows for the published package, whose function and class names are minified.
 */
const componentNames = (container: HTMLElement) => {
  const key = Object.keys(container).find(k => k.startsWith('__reactContainer$'))!
  const names: string[] = []
  const walk = (fiber: any) => {
    for (let f = fiber; f; f = f.sibling) {
      const type = typeof f.type === 'object' && f.type ? f.type.type ?? f.type : f.type
      if (typeof type === 'function' && type.displayName) names.push(type.displayName)
      walk(f.child)
    }
  }
  // the container points at the HostRoot fiber it was created with; its FiberRoot knows the current one
  walk((container as any)[key].stateNode.current.child)
  return names
}

const count = (names: string[], name: string) => names.filter(n => n === name).length

describe('AutoRootCtx component tree', () => {
  it('renders only the buckets that hold a running instance', async () => {
    const a = createStore('tree-a', () => ({ v: 'a' }))
    const b = createStore('tree-b', () => ({ v: 'b' }))
    const A = () => <i>{a.useStore().v}</i>
    const B = () => <i>{b.useStore().v}</i>
    const { container, rerender } = render(<AutoRootCtx />)
    await tick()
    expect(count(componentNames(container), 'Bucket')).toBe(0)

    rerender(<><AutoRootCtx /><A /><B /></>)
    await tick()
    const names = componentNames(container)
    expect(count(names, 'StoreInstance')).toBe(2)
    expect(count(names, 'Bucket')).toBeGreaterThanOrEqual(1)
    expect(count(names, 'Bucket')).toBeLessThanOrEqual(2)
    // one store under its bucket
    expect(names.slice(0, 6)).toEqual(['AutoRootCtx', 'Bucket', 'StoreInstance', 'StoreErrorBoundary', 'StoreFailure', names[5]])
    expect(names.filter(n => n.startsWith('Store(')).sort()).toEqual(['Store(tree-a)', 'Store(tree-b)'])

    rerender(<AutoRootCtx />)
    await tick()
    expect(count(componentNames(container), 'Bucket')).toBe(0)
  })

  it('names each store runner after its store', async () => {
    const { useStore } = createStore('tree-named', ({ id }: { id: number }) => ({ id }))
    const Row = ({ id }: { id: number }) => <i>{useStore({ id }).id}</i>
    const { container } = render(<><AutoRootCtx /><Row id={1} /><Row id={2} /></>)
    await tick()
    const names = componentNames(container)
    expect(count(names, 'Store(tree-named)')).toBe(2)
  })

  it('keeps every running store mounted while buckets around it come and go', async () => {
    let setCount!: (n: number) => void
    const kept = createStore('tree-kept', () => {
      const [n, set] = useState(0)
      setCount = set
      return { n }
    })
    const others = createStore('tree-others', ({ id }: { id: number }) => ({ id }))
    const Kept = () => <b data-testid="kept">{kept.useStore().n}</b>
    const Other = ({ id }: { id: number }) => <i>{others.useStore({ id }).id}</i>
    const tree = (from: number, to: number) => <>
      <AutoRootCtx />
      <Kept />
      {Array.from({ length: to - from }, (_, i) => <Other key={from + i} id={from + i} />)}
    </>
    const { rerender } = render(tree(0, 0))
    await tick()
    act(() => setCount(5))
    await tick()

    // fill most buckets, empty them, and fill others: under StrictMode a moved fiber would remount
    for (const [from, to] of [[0, 200], [0, 0], [500, 520], [0, 0]]) {
      rerender(tree(from, to))
      await tick()
    }
    expect(screen.getByTestId('kept').textContent).toBe('5')
  })
})
