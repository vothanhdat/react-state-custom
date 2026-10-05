# Update cadence

By default a component re-renders in the commit right after the store it reads changes. For data that changes faster than anyone reads it, such as a price feed, a sensor, a progress counter or a log, each reader can choose how often it follows:

```tsx
import { idle, throttle } from 'react-state-custom/schedulers'

// a depth chart of a few hundred points: ten times a second is plenty
const { bids, asks } = useBook({ symbol }, { schedule: throttle(100) })

// order history: render when the browser has time, within half a second
const ids = useAccount(undefined, { select: s => closedOrderIds(s.orders ?? {}), schedule: idle(500) })
```

## Schedulers

A schedule is a scheduler from one of these factories, imported from `react-state-custom/schedulers`. Only the ones you import end up in your bundle: an app that schedules nothing ships none of them.

| `schedule` | the component re-renders | for |
|---|---|---|
| `sync()` | in the commit after the change (the default) | what the user acts on: inputs, the price they are about to trade at |
| `frame()` | once per animation frame, with the latest data | many changes per frame on a view that should look live |
| `throttle(ms)` | at once, then at most once every `ms`, the last change included | expensive views that should look alive: charts, aggregates, totals |
| `debounce(ms, { maxWait })` | once changes stop for `ms`, and at least every `maxWait` while they go on (default 1000 ms, or `ms` when longer) | results that settle: a summary after edits, a filtered count |
| `idle(ms)` | when the browser is idle, at most `ms` later | logs, history tables, statistics, debug panels |

A factory returns the same scheduler for the same arguments, so calling it in render is fine. `0` ms gives `sync()`. A negative or non-numeric delay, or a value that is not a scheduler, logs a development error and renders at once. You can also [write your own](/api/schedulers#writing-a-scheduler).

## What waits and what does not

- **Only the reader's re-render waits.** The store runs and publishes at once. `storeRef(params).get()`, actions, `subscribe` listeners and the other readers see the change immediately.
- **The render reads the data of its moment.** Nothing is queued: a throttled reader skips the values in between, and a change that is undone before the run renders nothing.
- **First data is never held back.** When a store publishes for the first time, its readers render at once, whatever their schedule: a schedule limits how often the UI updates, not how soon it loads.
- **A render for another reason reads the latest data.** A parent re-render or the component's own state renders it with what the store holds now.
- **Readers due at the same moment render together.** All readers scheduled `frame()` render in one commit per frame, those with the same throttle on the same tick, the idle ones in the same idle callback.
- **Unmounting cancels.** So does a change of params or of schedule.

## Where to set it

- **Per reader**: the options of `useStore` or `useMultipleStore`.

  ```ts
  useStore(params, { schedule: frame() })
  useStore(params, { select, schedule: throttle(250) })
  useStore(undefined, { schedule: frame() })                // a store without params
  useMultipleStore(refs, { select, schedule: idle(500) })
  ```

- **Per store**: `createStore(name, useFn, { schedule })` sets the default of every reader. A reader that must stay current passes `{ schedule: sync() }`.
- **In the store itself**: when messages arrive faster than frames, publish once per frame from the store hook, with `useFrameState` or `scheduled(fn, frame())`. That saves the store's own renders and helps every reader. Do this first in stores that read a socket; then schedule the readers that need less than every frame.

  ```ts
  // one publish per frame however many batches arrive
  const [tickers, setTickers] = useFrameState<Record<string, Ticker>>({})
  useEffect(() => socket.subscribe('tickers', batch => setTickers(prev => merge(prev, batch))), [])

  // messages go into plain maps; one function turns them into state, once per frame
  useEffect(() => {
    const levels = new Map<number, number>()
    const publish = scheduled(() => setLevels(sorted(levels)), frame())
    const off = socket.subscribe('book', symbol, delta => { apply(levels, delta); publish() })
    return () => { off(); publish.cancel() }
  }, [symbol])
  ```

In an app [organized in layers](/guide/layers), the UI layer, which knows what each view shows, is the place for reader schedules. Core stores decide at most how often they publish.

## Consistency

A scheduled reader lags behind the store by up to its period. Two components showing the same value at different cadences can disagree for that long. So:

- Schedule leaf views: charts, tables, logs, counters. Keep readers that make decisions, and values the user compares while acting, on `sync()`.
- Effects of a scheduled component run late too. Do not drive side effects (a request, a save, a scroll) from scheduled reads.
- A handler that needs the current value reads `storeRef(params).get()`, which is never delayed.

## Choosing

- **`frame()`** helps when a store publishes several times per frame and a reader renders a lot. When the store already publishes once per frame, it changes nothing.
- **`throttle(ms)`** keeps a view alive at a fixed rate. The leading run shows the first change at once.
- **`debounce(ms)`** suits values that settle. `maxWait` keeps it rendering under a stream that never pauses; pass `debounce(ms, { maxWait: Infinity })` to wait for a pause however long it takes.
- **`idle(ms)`** moves a render out of the way of input and animation; it does not make it less frequent. When the main thread has time left in every frame, an idle reader renders about once per frame. React renders it in one go, so a slow render still takes its time. To render less often, use `throttle(ms)`.

`useDeferredValue` is the React way to keep input responsive: the urgent render goes first and the deferred one follows in an interruptible background render. A schedule skips renders instead. They combine; see [Concurrent rendering](/guide/concurrent).

## Measured

In the trading demo (`demos/trading`), the core stores publish once per frame and the UI layer throttles the depth chart to 100 ms and equity to 250 ms, and renders history and fills when idle. The ladder, about 1,400 commits per second at full speed, stays on every frame. Compared with the same demo without those schedules, in a production build in headless Chrome over three alternating runs, script time went from 134–142 to 129–132 ms per second at 20× feed speed and from 197–201 to 190 ms at 50×. The depth chart went from 60 to 10 commits per second. Both builds kept 60 fps with no long frames. Most of the work in that app is the ladder, so the savings are as large as the views you schedule.

## Testing

Pending scheduled renders wait for a frame, a timer or an idle callback. In tests, run them with `flushScheduled()` from `react-state-custom/testing`:

```ts
act(() => priceRef().get().setPrice!(101))
act(() => { flushScheduled() })
expect(screen.getByTestId('chart')).toHaveTextContent('101')
```

With fake timers, advance the clock instead: `vi.advanceTimersToNextFrame()` for frames, `vi.advanceTimersByTime(ms)` for throttles, debounces and the idle fallback. A throttle period starts in a microtask, so let pending promises settle (`await act(async () => {})`) before moving the clock.
