// The `schedule` option of useStore and createStore with the scheduler factories, the subscribe hooks
// built on it, `scheduled`, `useFrameState` and `flushScheduled`. Every test renders under StrictMode (tests/setup.ts).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { createRoot } from 'react-dom/client'
import { Profiler, useEffect, useRef, useState, type ReactNode } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'
import { getContext, useDataSubscribe } from '../src/state-utils/ctx'
import { scheduled, sync, type Scheduler } from '../src/state-utils/schedule'
import { debounce, frame, idle, throttle } from '../src/state-utils/schedulers'
import { useFrameState } from '../src/state-utils/useFrameState'
import { flushScheduled } from '../src/testing'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

let names = 0
const counterStore = (options: { schedule?: Scheduler, initialState?: { n: number } } = {}) =>
  createStore(`schedule-${++names}`, () => {
    const [n, setN] = useState(0)
    return { n, setN }
  }, options)

/** Values a component rendered, one entry per commit (StrictMode renders twice and runs mount effects twice). */
const committed = () => {
  const seen: unknown[] = []
  const Track = ({ value }: { value: unknown }) => {
    const render = {}
    const last = useRef<object>(undefined)
    useEffect(() => {
      if (last.current === render) return
      last.current = render
      seen.push(value)
    })
    return null
  }
  return { seen, Track }
}

/** Commits of everything under it. */
const commits = () => {
  const counter = { count: 0 }
  const Count = ({ children }: { children: ReactNode }) =>
    <Profiler id="count" onRender={() => { counter.count++ }}>{children}</Profiler>
  return { counter, Count }
}

describe('schedule: frame', () => {
  it('renders the latest value once per frame however often the store changes, every reader in one commit', async () => {
    vi.useFakeTimers()
    const { useStore, getStore } = counterStore()
    const { seen, Track } = committed()
    const { counter, Count } = commits()
    const Reader = () => <Track value={useStore(undefined, { schedule: frame() }).n} />
    render(<><AutoRootCtx /><Count><Reader /><Reader /><Reader /></Count></>)
    expect(seen).toEqual([undefined, undefined, undefined, 0, 0, 0])   // first data is not scheduled
    seen.length = 0

    counter.count = 0
    for (let i = 1; i <= 5; i++) await act(async () => getStore().get().setN!(i))
    expect(seen).toEqual([])
    expect(counter.count).toBe(0)

    await act(async () => { vi.advanceTimersToNextFrame() })
    expect(seen).toEqual([5, 5, 5])
    expect(counter.count).toBe(1)
  })

  it('leaves sync readers of the same store on time', async () => {
    vi.useFakeTimers()
    const { useStore, getStore } = counterStore()
    const Sync = () => <i data-testid="sync">{useStore().n}</i>
    const Frame = () => <b data-testid="frame">{useStore(undefined, { schedule: frame() }).n}</b>
    const { getByTestId } = render(<><AutoRootCtx /><Sync /><Frame /></>)
    await act(async () => getStore().get().setN!(1))
    expect(getByTestId('sync').textContent).toBe('1')
    expect(getByTestId('frame').textContent).toBe('0')
    await act(async () => { vi.advanceTimersToNextFrame() })
    expect(getByTestId('frame').textContent).toBe('1')
  })

  // On React's real scheduler: act() queues React's work until the act callback ends, after the
  // frame's own microtasks, so it cannot show what lands in the same frame.
  it('a store reading a frame-buffered source and its frame-scheduled readers update in the same frame', async () => {
    const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }
    const actEnvironment = scope.IS_REACT_ACT_ENVIRONMENT
    scope.IS_REACT_ACT_ENVIRONMENT = false
    const el = document.createElement('div')
    const root = createRoot(el)
    try {
      let push!: (n: number) => void
      const { useStore: useSource } = createStore(`schedule-source-${++names}`, () => {
        const [n, setN] = useFrameState(0)
        push = setN
        return { n }
      })
      const { useStore: useDouble } = createStore(`schedule-double-${++names}`, () => ({ double: (useSource().n ?? 0) * 2 }))
      const Reader = () => <b>{useDouble(undefined, { schedule: frame() }).double}</b>
      root.render(<><AutoRootCtx /><Reader /></>)
      const start = Date.now()
      while (el.textContent !== '0') {
        if (Date.now() - start > 2000) throw new Error(`not mounted: ${el.textContent}`)
        await new Promise(r => setTimeout(r, 10))
      }

      push(1); push(2); push(3)
      // the frame the pushes asked for, then a task: anything left for a later frame is not on screen yet
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))
      expect(el.textContent).toBe('6')
    } finally {
      root.unmount()
      scope.IS_REACT_ACT_ENVIRONMENT = actEnvironment
    }
  })
})

describe('schedule: throttle', () => {
  it('renders at once, then at most once per period with the last value', async () => {
    vi.useFakeTimers()
    const { useStore, getStore } = counterStore()
    const { seen, Track } = committed()
    const Reader = () => <Track value={useStore(undefined, { schedule: throttle(100) }).n} />
    render(<><AutoRootCtx /><Reader /></>)
    // the first data rendered at once, through the leading edge: let that period pass (the period
    // starts in a microtask, so let it run before moving the clock)
    await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(200) })
    seen.length = 0

    await act(async () => getStore().get().setN!(1))
    expect(seen).toEqual([1])                        // leading
    await act(async () => getStore().get().setN!(2))
    await act(async () => getStore().get().setN!(3))
    expect(seen).toEqual([1])
    await act(async () => { vi.advanceTimersByTime(100) })
    expect(seen).toEqual([1, 3])                     // trailing, the last value
    await act(async () => { vi.advanceTimersByTime(100) })   // a quiet period: the clock goes idle
    await act(async () => getStore().get().setN!(4))
    expect(seen).toEqual([1, 3, 4])                  // leading again
  })

  it('readers of one update render together, also on the leading edge', async () => {
    vi.useFakeTimers()
    const { useStore, getStore } = counterStore()
    const { counter, Count } = commits()
    const Reader = ({ id }: { id: string }) => <b data-testid={id}>{useStore(undefined, { schedule: throttle(50) }).n}</b>
    const { getByTestId } = render(<><AutoRootCtx /><Count><Reader id="a" /><Reader id="b" /></Count></>)
    await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(100) })
    counter.count = 0
    await act(async () => getStore().get().setN!(1))
    expect([getByTestId('a').textContent, getByTestId('b').textContent]).toEqual(['1', '1'])
    expect(counter.count).toBe(1)
  })
})

describe('schedule: debounce', () => {
  it('renders once changes stop for the wait', async () => {
    vi.useFakeTimers()
    const { useStore, getStore } = counterStore()
    const { seen, Track } = committed()
    const Reader = () => <Track value={useStore(undefined, { schedule: debounce(50) }).n} />
    render(<><AutoRootCtx /><Reader /></>)
    seen.length = 0
    for (let i = 1; i <= 3; i++) {
      await act(async () => getStore().get().setN!(i))
      await act(async () => { vi.advanceTimersByTime(30) })
    }
    expect(seen).toEqual([])
    await act(async () => { vi.advanceTimersByTime(50) })
    expect(seen).toEqual([3])
  })

  it('renders at least every maxWait (default 1000 ms) while changes never stop', async () => {
    vi.useFakeTimers()
    const { useStore, getStore } = counterStore()
    const { seen, Track } = committed()
    const Reader = () => <Track value={useStore(undefined, { schedule: debounce(50) }).n} />
    render(<><AutoRootCtx /><Reader /></>)
    seen.length = 0
    // 60 changes a second for two seconds: a debounce without maxWait never renders
    for (let i = 1; i <= 120; i++) {
      await act(async () => getStore().get().setN!(i))
      await act(async () => { vi.advanceTimersByTime(16) })
    }
    expect(seen.length).toBe(1)
    expect(seen[0]).toBeGreaterThan(55)              // about a second in
    expect(seen[0]).toBeLessThan(70)
    await act(async () => { vi.advanceTimersByTime(50) })
    expect(seen).toEqual([seen[0], 120])
  })

  it('useDataSubscribe(ctx, key, ms) is a debounce that no longer starves under a stream', async () => {
    vi.useFakeTimers()
    const ctx = getContext('schedule-raw-debounce')
    const { seen, Track } = committed()
    const Reader = () => <Track value={useDataSubscribe(ctx, 'n', 50)} />
    render(<Reader />)
    for (let i = 1; i <= 120; i++) {
      act(() => ctx.publish('n', i))
      await act(async () => { vi.advanceTimersByTime(16) })
    }
    expect(seen.length).toBe(2)                      // undefined, then about a second in
    await act(async () => { vi.advanceTimersByTime(100) })
    expect(seen[seen.length - 1]).toBe(120)
  })
})

describe('schedule: idle', () => {
  it('renders when the browser is idle', async () => {
    vi.useFakeTimers()
    const callbacks: (() => void)[] = []
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => callbacks.push(cb))
    vi.stubGlobal('cancelIdleCallback', () => { })
    const { useStore, getStore } = counterStore()
    const { seen, Track } = committed()
    const Reader = () => <Track value={useStore(undefined, { schedule: idle(500) }).n} />
    render(<><AutoRootCtx /><Reader /></>)
    seen.length = 0
    await act(async () => getStore().get().setN!(1))
    await act(async () => getStore().get().setN!(2))
    expect(seen).toEqual([])
    expect(callbacks).toHaveLength(1)
    await act(async () => callbacks[0]!())
    expect(seen).toEqual([2])
  })

  it('without requestIdleCallback, renders within the timeout', async () => {
    vi.useFakeTimers()
    const { useStore, getStore } = counterStore()
    const { seen, Track } = committed()
    const Reader = () => <Track value={useStore(undefined, { schedule: idle(200) }).n} />
    render(<><AutoRootCtx /><Reader /></>)
    seen.length = 0
    await act(async () => getStore().get().setN!(1))
    await act(async () => { vi.advanceTimersByTime(199) })
    expect(seen).toEqual([])
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(seen).toEqual([1])
  })
})

describe('schedule: rules', () => {
  it('first data is never held back', async () => {
    vi.useFakeTimers()
    const { useStore } = createStore(`schedule-first-${++names}`, () => ({ ready: 'yes' as const }), { initialState: { ready: 'no' as 'no' | 'yes' } })
    const Reader = () => <b data-testid="r">{useStore(undefined, { schedule: throttle(60_000) }).ready}</b>
    const Select = () => <i data-testid="s">{useStore(undefined, s => s.ready, { schedule: debounce(60_000) })}</i>
    const { getByTestId } = render(<><AutoRootCtx /><Reader /><Select /></>)
    expect(getByTestId('r').textContent).toBe('yes')
    expect(getByTestId('s').textContent).toBe('yes')
  })

  it('checks again when the run comes: a change undone meanwhile renders nothing', async () => {
    vi.useFakeTimers()
    const { useStore, getStore } = counterStore()
    const { seen, Track } = committed()
    const Proxy = () => <Track value={`p${useStore(undefined, { schedule: frame() }).n}`} />
    const Select = () => <Track value={`s${useStore(undefined, s => s.n, { schedule: frame() })}`} />
    render(<><AutoRootCtx /><Proxy /><Select /></>)
    seen.length = 0
    await act(async () => getStore().get().setN!(1))
    await act(async () => getStore().get().setN!(0))
    await act(async () => { vi.advanceTimersToNextFrame() })
    expect(seen).toEqual([])
  })

  it('an unmounted reader has nothing pending', async () => {
    const { useStore, getStore } = counterStore()
    const Reader = () => <b>{useStore(undefined, { schedule: frame() }).n}</b>
    const App = ({ show }: { show: boolean }) => <><AutoRootCtx />{show && <Reader />}<Keep /></>
    const Keep = () => { useStore(); return null }
    const r = render(<App show={true} />)
    await act(async () => getStore().get().setN!(1))
    r.rerender(<App show={false} />)
    let ran: boolean | undefined
    act(() => { ran = flushScheduled() })
    expect(ran).toBe(false)
  })

  it('the store option is the default; a reader passes its own', async () => {
    vi.useFakeTimers()
    const { useStore, getStore } = counterStore({ schedule: frame() })
    const Frame = () => <b data-testid="frame">{useStore().n}</b>
    const Sync = () => <i data-testid="sync">{useStore(undefined, { schedule: sync() }).n}</i>
    const { getByTestId } = render(<><AutoRootCtx /><Frame /><Sync /></>)
    await act(async () => getStore().get().setN!(1))
    expect(getByTestId('frame').textContent).toBe('0')
    expect(getByTestId('sync').textContent).toBe('1')
    await act(async () => { vi.advanceTimersToNextFrame() })
    expect(getByTestId('frame').textContent).toBe('1')
  })

  it('equal arguments give the same scheduler, so calling a factory in render costs nothing', () => {
    expect(throttle(100)).toBe(throttle(100))
    expect(frame()).toBe(frame())
    expect(debounce(50)).toBe(debounce(50, { maxWait: 1000 }))
    expect(debounce(2000)).toBe(debounce(2000, { maxWait: 2000 }))   // maxWait defaults to ms when longer
    expect(idle(0)).toBe(sync())
    expect(throttle(0)).toBe(sync())
    expect(throttle(100).name).toBe('throttle(100)')
  })

  it('a reader can change its schedule', async () => {
    vi.useFakeTimers()
    const { useStore, getStore } = counterStore()
    const Reader = ({ schedule }: { schedule: Scheduler }) => <b data-testid="r">{useStore(undefined, { schedule }).n}</b>
    const { getByTestId, rerender } = render(<><AutoRootCtx /><Reader schedule={frame()} /></>)
    rerender(<><AutoRootCtx /><Reader schedule={sync()} /></>)
    await act(async () => getStore().get().setN!(1))
    expect(getByTestId('r').textContent).toBe('1')
  })

  it('a bad delay or a value that is not a scheduler logs an error and renders at once', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => { })
    const { useStore, getStore } = counterStore()
    const Bad = () => <b data-testid="bad">{useStore(undefined, { schedule: throttle(-5) }).n}</b>
    const Old = () => <i data-testid="old">{useStore(undefined, { schedule: 'frame' as any }).n}</i>
    const { getByTestId } = render(<><AutoRootCtx /><Bad /><Old /></>)
    await act(async () => getStore().get().setN!(1))
    expect(getByTestId('bad').textContent).toBe('1')
    expect(getByTestId('old').textContent).toBe('1')
    const messages = error.mock.calls.map(([m]) => String(m))
    expect(messages.some(m => m.includes('throttle(-5): expected a number of milliseconds'))).toBe(true)
    expect(messages.some(m => m.includes('frame is not a schedule'))).toBe(true)
    error.mockRestore()
  })

  it('says so when the options are passed as the params of a store without params', () => {
    const { useStore } = counterStore()
    const Reader = () => { useStore({ schedule: frame() } as any); return null }
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => { })
    expect(() => render(<Reader />)).toThrow('Options come after the params')
    quiet.mockRestore()
  })
})

describe('useStore(selector) on a store without params', () => {
  it('reads like useStore(undefined, selector), with isEqual or options', async () => {
    const { useStore, getStore } = counterStore()
    const Reader = () => {
      const odd = useStore(s => (s.n ?? 0) % 2 === 1)
      const n = useStore(s => s.n, { isEqual: Object.is })
      const same = useStore(s => s.n, (a, b) => a === b)
      return <b data-testid="r">{`${odd} ${n} ${same}`}</b>
    }
    const { getByTestId } = render(<><AutoRootCtx /><Reader /></>)
    await act(async () => getStore().get().setN!(3))
    expect(getByTestId('r').textContent).toBe('true 3 3')
  })
})

describe('scheduled', () => {
  it('turns calls before a run into one run with the last arguments', async () => {
    vi.useFakeTimers()
    const runs: number[] = []
    const log = scheduled((n: number) => { runs.push(n) }, throttle(100))
    log(1)
    log(2)          // same burst as the leading run, so it runs too
    await Promise.resolve()
    log(3)
    log(4)
    expect(runs).toEqual([1, 2])
    vi.advanceTimersByTime(100)
    expect(runs).toEqual([1, 2, 4])
  })

  it('cancel forgets a pending run, flush makes it now', () => {
    vi.useFakeTimers()
    const runs: string[] = []
    const run = scheduled((s: string) => { runs.push(s) }, debounce(50))
    run('a')
    run.cancel()
    vi.advanceTimersByTime(100)
    run('b')
    run.flush()
    vi.advanceTimersByTime(100)
    expect(runs).toEqual(['b'])
  })

  it('flushScheduled runs every pending call', () => {
    const runs: string[] = []
    scheduled((s: string) => { runs.push(s) }, frame())('frame')
    scheduled((s: string) => { runs.push(s) }, debounce(1000))('debounce')
    scheduled((s: string) => { runs.push(s) }, idle(1000))('idle')
    expect(flushScheduled()).toBe(true)
    expect(runs.sort()).toEqual(['debounce', 'frame', 'idle'])
    expect(flushScheduled()).toBe(false)
  })
})

describe('useFrameState', () => {
  it('applies the updates of a frame in order and renders once', async () => {
    vi.useFakeTimers()
    let set!: (update: number | ((n: number) => number)) => void
    const { seen, Track } = committed()
    const Counter = () => {
      const [n, setN] = useFrameState(0)
      set = setN
      return <Track value={n} />
    }
    render(<Counter />)
    act(() => { set(5); set(n => n + 1); set(n => n * 2) })
    expect(seen).toEqual([0])
    await act(async () => { vi.advanceTimersToNextFrame() })
    expect(seen).toEqual([0, 12])
  })

  it('makes a store publish once per frame', async () => {
    vi.useFakeTimers()
    let push!: (n: number) => void
    let storeRenders = 0
    const { useStore } = createStore(`schedule-frame-state-${++names}`, () => {
      const [n, setN] = useFrameState(0)
      push = setN
      useEffect(() => { storeRenders++ })
      return { n }
    })
    const Reader = () => <b data-testid="n">{useStore().n}</b>
    const { getByTestId } = render(<><AutoRootCtx /><Reader /></>)
    storeRenders = 0
    act(() => { for (let i = 1; i <= 50; i++) push(i) })
    await act(async () => { vi.advanceTimersToNextFrame() })
    expect(getByTestId('n').textContent).toBe('50')
    expect(storeRenders).toBe(1)
  })
})
