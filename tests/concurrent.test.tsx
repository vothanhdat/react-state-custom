import { describe, it, expect } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import * as React from 'react'
import { Suspense, memo, startTransition, useDeferredValue, useState } from 'react'
import { createStore, AutoRootCtx } from '../src'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

/** React 19.2+ only; the React 18 CI job skips the tests that use it. */
const Activity = (React as any).Activity as React.ComponentType<{ mode: 'visible' | 'hidden', children?: React.ReactNode }> | undefined

describe('a transition that suspends', () => {
  // The transition renders Reader reading only `b`, then a sibling suspends: React keeps the committed
  // UI, which reads `a`, on screen while it waits. That UI must keep following `a`.
  const setup = (Reader: React.FC<{ mode: 'a' | 'b' }>) => {
    const never = new Promise<void>(() => {})
    const Suspender = ({ on }: { on: boolean }) => { if (on) throw never; return null }
    let setMode: (m: 'a' | 'b') => void = () => {}
    const App = () => {
      const [mode, _setMode] = useState<'a' | 'b'>('a')
      setMode = _setMode
      return <Suspense fallback="loading"><Reader mode={mode} /><Suspender on={mode === 'b'} /></Suspense>
    }
    const utils = render(<><AutoRootCtx /><App /></>)
    return { ...utils, setMode: (m: 'a' | 'b') => setMode(m) }
  }

  const createAB = (name: string) => {
    let setA: (n: number) => void = () => {}
    const store = createStore(name, () => {
      const [a, _setA] = useState(0)
      setA = _setA
      return { a, b: 'B' }
    })
    return { ...store, setA: (n: number) => setA(n) }
  }

  it('keeps the UI on screen subscribed to the keys it read (proxy)', async () => {
    const { useStore, setA } = createAB('transition-proxy')
    const Reader = ({ mode }: { mode: 'a' | 'b' }) => {
      const s = useStore()
      return <span data-testid="v">{mode === 'a' ? String(s.a) : s.b}</span>
    }
    const { getByTestId, setMode } = setup(Reader)
    await tick()
    expect(getByTestId('v').textContent).toBe('0')

    act(() => { startTransition(() => setMode('b')) })
    await tick()
    expect(getByTestId('v').textContent).toBe('0')

    act(() => { setA(5) })
    await tick()
    expect(getByTestId('v').textContent).toBe('5')
  })

  it('keeps the UI on screen subscribed to its selection (selector)', async () => {
    const { useStore, setA } = createAB('transition-selector')
    const Reader = ({ mode }: { mode: 'a' | 'b' }) => {
      const v = useStore(undefined, { select: s => mode === 'a' ? String(s.a) : s.b })
      return <span data-testid="v">{v}</span>
    }
    const { getByTestId, setMode } = setup(Reader)
    await tick()
    act(() => { startTransition(() => setMode('b')) })
    await tick()
    act(() => { setA(5) })
    await tick()
    expect(getByTestId('v').textContent).toBe('5')
  })
})

describe('a transition that suspends, when the discarded render selects what is on screen', () => {
  // `b` equals the value of `a` on screen, so the selection of the discarded render (`b`) equals the
  // selection on screen: checking changes with it would miss the change of `a`.
  const run = async (name: string, Reader: (props: { mode: 'a' | 'b', store: ReturnType<typeof createAB> }) => React.ReactNode) => {
    const store = createAB(name)
    const never = new Promise<void>(() => {})
    const Suspender = ({ on }: { on: boolean }) => { if (on) throw never; return null }
    let setMode: (m: 'a' | 'b') => void = () => {}
    const App = () => {
      const [mode, _setMode] = useState<'a' | 'b'>('a')
      setMode = _setMode
      return <Suspense fallback="loading"><Reader mode={mode} store={store} /><Suspender on={mode === 'b'} /></Suspense>
    }
    const { getByTestId } = render(<><AutoRootCtx /><App /></>)
    await tick()
    act(() => { startTransition(() => setMode('b')) })
    await tick()
    act(() => { store.setA(5) })
    await tick()
    expect(getByTestId('v').textContent).toBe('5')
  }

  const createAB = (name: string) => {
    let setA: (n: number) => void = () => {}
    const store = createStore(name, () => {
      const [a, _setA] = useState(0)
      setA = _setA
      return { a, b: 0 }
    })
    return { ...store, setA: (n: number) => setA(n) }
  }

  it('useStore with a selector', () => run('coincide-selector', ({ mode, store }) =>
    <span data-testid="v">{String(store.useStore(undefined, { select: s => mode === 'a' ? s.a : s.b }))}</span>))
})

describe('useDeferredValue on a store value', () => {
  it('renders the input with the new value first and the deferred part in a later render', async () => {
    const { useStore } = createStore('deferred-search', () => {
      const [query, setQuery] = useState('')
      return { query, setQuery }
    })
    const log: string[] = []
    const Results = memo(({ query }: { query: string }) => { log.push(`results:${query}`); return null })
    const Search = () => {
      const { query = '', setQuery } = useStore()
      const deferred = useDeferredValue(query)
      log.push(`search:${query}/${deferred}`)
      return <><input data-testid="q" value={query} onChange={e => setQuery?.(e.target.value)} /><Results query={deferred} /></>
    }
    const { getByTestId } = render(<><AutoRootCtx /><Search /></>)
    await tick()

    log.length = 0
    act(() => { fireEvent.change(getByTestId('q'), { target: { value: 'x' } }) })
    await tick()

    expect((getByTestId('q') as HTMLInputElement).value).toBe('x')
    // first the urgent render: new query, previous deferred value, Results skipped (memo)
    const urgent = log.indexOf('search:x/')
    const deferred = log.indexOf('search:x/x')
    expect(urgent).toBeGreaterThanOrEqual(0)
    expect(deferred).toBeGreaterThan(urgent)
    expect(log.indexOf('results:x')).toBeGreaterThan(deferred)
    expect(log.slice(0, deferred)).not.toContain('results:x')
  })
})

describe.skipIf(!Activity)('<Activity mode="hidden">', () => {
  const setup = (name: string, options: { timeToClean?: number } = {}) => {
    let increment = () => {}
    const { useStore } = createStore(name, (_: {}) => {
      const [n, setN] = useState(0)
      increment = () => setN(x => x + 1)
      return { n }
    }, { timeToClean: options.timeToClean ?? 0 })
    const Reader = () => <span data-testid="n">{String(useStore().n)}</span>
    let setVisible: (v: boolean) => void = () => {}
    const App = () => {
      const [visible, _setVisible] = useState(true)
      setVisible = _setVisible
      const Hideable = Activity!
      return <Hideable mode={visible ? 'visible' : 'hidden'}><Reader /></Hideable>
    }
    const utils = render(<><AutoRootCtx /><App /></>)
    const hideAndShow = async () => {
      act(() => setVisible(false))
      await tick(200)
      act(() => setVisible(true))
      await tick()
    }
    const countTo3 = async () => {
      await tick()
      act(() => { increment(); increment(); increment() })
      await tick()
      expect(utils.getByTestId('n').textContent).toBe('3')
    }
    return { ...utils, hideAndShow, countTo3 }
  }

  it('releases the store like an unmount: shown again, a fresh instance starts', async () => {
    const { getByTestId, hideAndShow, countTo3 } = setup('activity-fresh')
    await countTo3()
    await hideAndShow()
    expect(getByTestId('n').textContent).toBe('0')
  })

  it('keeps the instance running through timeToClean', async () => {
    const { getByTestId, hideAndShow, countTo3 } = setup('activity-time-to-clean', { timeToClean: 60_000 })
    await countTo3()
    await hideAndShow()
    expect(getByTestId('n').textContent).toBe('3')
  })
})
