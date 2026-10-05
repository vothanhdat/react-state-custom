# Schedulers

When a reader re-renders for a change of a store, and when a `scheduled` function runs. Each scheduler is a factory exported by the package; only the ones you import end up in your bundle. See [Update cadence](/guide/update-cadence) for when to use which.

```ts
import { sync, frame, throttle, debounce, idle, scheduled, useFrameState } from 'react-state-custom'
import type { Scheduler, ScheduledTask } from 'react-state-custom'

useStore(params, { schedule: throttle(100) })
useStore(params, selector, { isEqual, schedule: frame() })
createStore('portfolio', usePortfolioState, { schedule: throttle(250) })
```

Every factory returns the same scheduler for the same arguments (`throttle(100) === throttle(100)`), so calling one in render is fine. Runs due at the same moment (one frame, one throttle tick, one debounce timer, one idle callback) happen in one batch, and React renders them in one commit.

## `sync()`

```ts
function sync(): Scheduler
```

At once, in the commit after the change. The default; pass it to override a store's `schedule` for one reader.

## `frame()`

```ts
function frame(): Scheduler
```

Once per animation frame (`requestAnimationFrame`), with the data of that frame. What a frame's renders publish to readers that are also on `frame()` lands in the same frame: a store reading a frame-buffered store, and that store's readers, update together. Without `requestAnimationFrame`, a 16 ms timer.

## `throttle(ms)`

```ts
function throttle(ms: number): Scheduler
```

At once, then at most once every `ms` while changes go on, the last change included. Readers with the same `ms` share one clock, so readers of one update render together, on the first change too. `0` gives `sync()`.

## `debounce(ms, options?)`

```ts
function debounce(ms: number, options?: { maxWait?: number }): Scheduler
```

Once changes stop for `ms`, and at least every `maxWait` while they go on, so a stream that never pauses still renders. `maxWait` defaults to 1000 ms, or `ms` when that is longer; `Infinity` waits for a pause however long it takes. `0` gives `sync()`.

## `idle(ms)`

```ts
function idle(ms: number): Scheduler
```

When the browser is idle (`requestIdleCallback`), and at most `ms` after the change. It moves a render out of the way of input and animation; it does not make it less frequent. Without `requestIdleCallback` (Safari, jsdom), a timer of `ms`. `0` gives `sync()`.

## `scheduled(fn, scheduler)`

```ts
function scheduled<A extends unknown[]>(fn: (...args: A) => void, scheduler: Scheduler):
  ((...args: A) => void) & { cancel(): void, flush(): void }
```

`fn` on a scheduler, for code outside render. Calling the returned function asks for a run; the calls made before that run are one run, with the arguments of the last call. `cancel()` forgets a pending run, `flush()` makes it now.

```ts
useEffect(() => {
  const levels = new Map<number, number>()
  const publish = scheduled(() => setBook(snapshotOf(levels)), frame())
  const off = socket.subscribe(symbol, delta => { apply(levels, delta); publish() })
  return () => { off(); publish.cancel() }
}, [symbol])
```

## `useFrameState(initial?)`

```ts
function useFrameState<T>(initial: T | (() => T)): [T, (update: SetStateAction<T>) => void]
```

`useState` whose updates apply once per animation frame. The updates set during a frame apply in order, and the component renders once, in the frame, together with the readers on `frame()`. The setter is stable.

```ts
const [tickers, setTickers] = useFrameState<Record<string, Ticker>>({})
useEffect(() => socket.subscribe('tickers', batch => setTickers(prev => merge(prev, batch))), [])
```

In a store hook, the store publishes once per frame instead of once per message. Use `scheduled` instead when the messages go into a mutable buffer and one function turns it into state.

## Writing a scheduler

A scheduler is an object with a `name` and a `task(run)` method. `task` is called once per reader (and once per `scheduled` function) and returns a task: `request()` asks for a run of `run`, and requests made before the run happens are one run; `cancel()` forgets a pending run.

```ts
type Scheduler = { readonly name: string, task(run: () => void): ScheduledTask }
type ScheduledTask = { request(): void, cancel(): void }

// re-render after every second frame
const pending = new Set<() => void>()
let odd = false
const loop = () => {
  if ((odd = !odd)) { requestAnimationFrame(loop); return }
  const runs = [...pending]
  pending.clear()
  runs.forEach(run => run())
}
export const everyOtherFrame: Scheduler = {
  name: 'everyOtherFrame',
  task: run => ({
    request: () => { if (pending.size === 0) requestAnimationFrame(loop); pending.add(run) },
    cancel: () => { pending.delete(run) },
  }),
}
```

Readers compare schedulers by identity: create yours once, at module scope, or cache it per argument as the built-in factories do. A store's first data never waits for the scheduler; everything after it does. `flushScheduled()` from `react-state-custom/testing` reaches only the built-in schedulers.
