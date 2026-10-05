import { isProduction } from "./utils"

/**
 * When a consumer re-renders for a store change (the `schedule` option of `useStore`), or when a
 * function made with `scheduled` runs:
 * - `'sync'`: at once. The default.
 * - `'frame'`: once per animation frame.
 * - `{ throttle: ms }`: at once, then at most once every `ms` while changes go on, the last one included.
 * - `{ debounce: ms, maxWait? }`: once changes stop for `ms`, and at least every `maxWait` while they go
 *   on. `maxWait` defaults to 1000 ms, or `ms` when that is longer; `Infinity` waits for a pause however long.
 * - `{ idle: ms }`: when the browser is idle, and at most `ms` later.
 *
 * Every run due at the same moment (the same frame, the same throttle or debounce tick, the same idle
 * callback) happens in one batch, so React renders all of it in one commit.
 */
export type Schedule =
  | 'sync'
  | 'frame'
  | { throttle: number }
  | { debounce: number, maxWait?: number }
  | { idle: number }

/** A schedule checked and shared: equal schedules give the same plan, so a plan can be compared by identity. */
export type Plan =
  | { readonly kind: 'sync' }
  | { readonly kind: 'frame' }
  | { readonly kind: 'throttle', readonly ms: number }
  | { readonly kind: 'debounce', readonly ms: number, readonly maxWait: number }
  | { readonly kind: 'idle', readonly ms: number }

export const SYNC: Plan = Object.freeze({ kind: 'sync' })
const FRAME: Plan = Object.freeze({ kind: 'frame' })

const plans = new Map<string, Plan>()

/** The shared plan for `key`, made by `make` the first time. Runs on every render of a scheduled reader. */
const intern = (key: string, make: () => Plan): Plan => {
  let shared = plans.get(key)
  if (!shared) plans.set(key, shared = Object.freeze(make()))
  return shared
}

const warned = new Set<string>()

const invalid = (schedule: unknown): Plan => {
  if (!isProduction) {
    const text = typeof schedule === 'object' && schedule !== null ? JSON.stringify(schedule) : String(schedule)
    if (!warned.has(text)) {
      warned.add(text)
      console.error(
        `[react-state-custom] Unknown schedule ${text}: use 'sync', 'frame', { throttle: ms }, ` +
        `{ debounce: ms, maxWait?: ms } or { idle: ms }, with ms a positive number. Rendering at once instead.`
      )
    }
  }
  return SYNC
}

/**
 * A number of milliseconds (0 for no delay, a delay longer than a timer can wait capped to the longest
 * one), or undefined when `value` is not one. `maxWait` keeps `Infinity`: it means "no cap".
 */
const msOf = (value: unknown, cap = MAX_TIMEOUT) => typeof value === 'number' && value >= 0 ? Math.min(value, cap) : undefined

/** The plan of a schedule. `0` ms means no delay (`'sync'`); anything that is not a schedule logs an error and runs sync. */
export const planOf = (schedule: Schedule | undefined): Plan => {
  if (schedule === undefined || schedule === 'sync') return SYNC
  if (schedule === 'frame') return FRAME
  if (typeof schedule !== 'object' || schedule === null) return invalid(schedule)
  if ('throttle' in schedule) {
    const ms = msOf(schedule.throttle)
    return ms === undefined ? invalid(schedule) : ms === 0 ? SYNC : intern(`t${ms}`, () => ({ kind: 'throttle', ms }))
  }
  if ('debounce' in schedule) {
    const ms = msOf(schedule.debounce)
    const maxWait = schedule.maxWait === undefined ? Math.max(ms ?? 0, DEFAULT_MAX_WAIT) : msOf(schedule.maxWait, Infinity)
    if (ms === undefined || maxWait === undefined) return invalid(schedule)
    return ms === 0 || maxWait === 0 ? SYNC : intern(`d${ms}/${maxWait}`, () => ({ kind: 'debounce', ms, maxWait }))
  }
  if ('idle' in schedule) {
    const ms = msOf(schedule.idle)
    return ms === undefined ? invalid(schedule) : ms === 0 ? SYNC : intern(`i${ms}`, () => ({ kind: 'idle', ms }))
  }
  return invalid(schedule)
}

/** A debounce renders at least this often while changes go on: a stream never pauses, and would never render. */
const DEFAULT_MAX_WAIT = 1000

/** The longest delay `setTimeout` waits; a longer one runs at once. */
const MAX_TIMEOUT = 2 ** 31 - 1

/** Timers fire up to a millisecond early in some environments: a run this close to its time is due. */
const SLACK = 1

const later = (fn: () => void, ms: number) => {
  const id = setTimeout(fn, Math.min(Math.max(ms, 0), MAX_TIMEOUT))
  return () => clearTimeout(id)
}

// Looked up at each call, not at load, so test environments can fake them.
const nextFrame = (fn: () => void) => {
  if (typeof requestAnimationFrame !== 'function') return later(fn, 16)
  const id = requestAnimationFrame(fn)
  return () => cancelAnimationFrame(id)
}

const whenIdle = (fn: () => void, timeout: number) => {
  if (typeof requestIdleCallback !== 'function' || typeof cancelIdleCallback !== 'function') return later(fn, timeout)
  const id = requestIdleCallback(fn, { timeout: Math.min(timeout, MAX_TIMEOUT) })
  return () => cancelIdleCallback(id)
}

/** One scheduled function, as the queues hold it. */
type Entry = { run: () => void }

/** Run every entry, then rethrow the first error: one that throws must not keep the others waiting. */
const runAll = (entries: Iterable<Entry>) => {
  let error: unknown
  let failed = false
  for (const entry of entries) {
    try {
      entry.run()
    } catch (e) {
      if (!failed) { failed = true; error = e }
    }
  }
  if (failed) throw error
}

const take = <T,>(set: Set<T>) => {
  const items = [...set]
  set.clear()
  return items
}

// ---------------------------------------------------------------------------------------- frame

/**
 * What a frame's runs render can schedule more for the frame: a store reading a frame-scheduled
 * source publishes, and its frame-scheduled readers ask for a frame. React renders those updates in
 * a microtask queued while the runs notified it, so a microtask queued after the runs comes after
 * that render: it runs what it scheduled, in the same frame. A few rounds at most, then next frame.
 */
const MAX_FRAME_ROUNDS = 8

const frame = {
  entries: new Set<Entry>(),
  cancel: undefined as (() => void) | undefined,
  /** > 0 while a frame is running its entries, rounds included. */
  round: 0,
}

const requestFrame = (entry: Entry) => {
  frame.entries.add(entry)
  if (frame.round === 0 && !frame.cancel) frame.cancel = nextFrame(onFrame)
}

const onFrame = () => {
  frame.cancel = undefined
  frame.round = 1
  drainFrame()
}

const drainFrame = () => {
  if (frame.entries.size === 0) {
    frame.round = 0
    return
  }
  const entries = take(frame.entries)
  try {
    runAll(entries)
  } finally {
    if (frame.round < MAX_FRAME_ROUNDS) {
      frame.round++
      queueMicrotask(drainFrame)
    } else {
      frame.round = 0
      if (frame.entries.size > 0) frame.cancel = nextFrame(onFrame)
    }
  }
}

// ---------------------------------------------------------------------------------------- throttle

/**
 * The throttles of one `ms` share a clock: a run at once when the clock is idle (its first change
 * and every one made before the next microtask, so readers of one update render together), then the
 * changes in between every `ms` while there are some. A run for an entry that ran less than `ms` ago
 * therefore never happens: the clock goes idle only after a whole period with no change.
 */
type Clock = { ms: number, phase: 'idle' | 'leading' | 'cooling', pending: Set<Entry>, cancel?: () => void }

const clocks = new Map<number, Clock>()

const requestThrottle = (ms: number, entry: Entry) => {
  let clock = clocks.get(ms)
  if (!clock) clocks.set(ms, clock = { ms, phase: 'idle', pending: new Set() })
  if (clock.phase === 'cooling') {
    clock.pending.add(entry)
    return
  }
  if (clock.phase === 'idle') {
    clock.phase = 'leading'
    const started = clock
    queueMicrotask(() => {
      if (started.phase !== 'leading') return
      started.phase = 'cooling'
      started.cancel = later(() => tick(started), ms)
    })
  }
  entry.run()
}

const tick = (clock: Clock) => {
  clock.cancel = undefined
  if (clock.pending.size === 0) {
    clock.phase = 'idle'
    return
  }
  const entries = take(clock.pending)
  clock.cancel = later(() => tick(clock), clock.ms)
  runAll(entries)
}

// ---------------------------------------------------------------------------------------- debounce

/** A debounced entry waiting for its time. `next` says when it is due after all, or `undefined` for now. */
type Timed = Entry & { due: number, next: (now: number) => number | undefined }

/** Every pending debounce, with one timer for the earliest: entries due together run in one batch. */
const timed = new Set<Timed>()
let timer: { at: number, cancel: () => void } | undefined

const arm = () => {
  let at = Infinity
  for (const entry of timed) if (entry.due < at) at = entry.due
  if (timer) {
    if (timer.at === at) return
    timer.cancel()
    timer = undefined
  }
  if (at !== Infinity) timer = { at, cancel: later(onTimer, at - Date.now()) }
}

const onTimer = () => {
  timer = undefined
  const now = Date.now()
  const due: Timed[] = []
  for (const entry of timed) {
    if (entry.due > now + SLACK) continue
    const next = entry.next(now)
    if (next === undefined) {
      timed.delete(entry)
      due.push(entry)
    } else {
      entry.due = next
    }
  }
  arm()
  runAll(due)
}

// ---------------------------------------------------------------------------------------- idle

const idle = {
  entries: new Set<Entry>(),
  /** When the pending callback runs at the latest. */
  at: Infinity,
  cancel: undefined as (() => void) | undefined,
}

const requestIdle = (ms: number, entry: Entry) => {
  if (idle.entries.has(entry)) return
  idle.entries.add(entry)
  const deadline = Date.now() + ms
  if (idle.cancel && idle.at <= deadline) return
  idle.cancel?.()
  idle.at = deadline
  idle.cancel = whenIdle(onIdle, ms)
}

const onIdle = () => {
  idle.cancel = undefined
  idle.at = Infinity
  runAll(take(idle.entries))
}

// ---------------------------------------------------------------------------------------- tasks

/** A function run on a schedule: `request()` asks for a run, which happens when the schedule says. */
export type Task = {
  request(): void
  /** Forget a requested run that has not happened yet. */
  cancel(): void
}

const noop = () => { }

/** A task running `run` on `plan`. Requests made before a run happens are one run. */
export const createTask = (plan: Plan, run: () => void): Task => {
  switch (plan.kind) {
    case 'sync':
      return { request: run, cancel: noop }
    case 'frame': {
      const entry: Entry = { run }
      return { request: () => requestFrame(entry), cancel: () => { frame.entries.delete(entry) } }
    }
    case 'throttle': {
      const entry: Entry = { run }
      return { request: () => requestThrottle(plan.ms, entry), cancel: () => { clocks.get(plan.ms)?.pending.delete(entry) } }
    }
    case 'idle': {
      const entry: Entry = { run }
      return { request: () => requestIdle(plan.ms, entry), cancel: () => { idle.entries.delete(entry) } }
    }
    case 'debounce': {
      const { ms, maxWait } = plan
      let first = 0
      let last = 0
      const entry: Timed = {
        run,
        due: 0,
        next(now) {
          const at = Math.min(last + ms, first + maxWait)
          // never further than one wait away, in case the clock went back
          return now + SLACK >= at ? undefined : Math.min(at, now + ms)
        },
      }
      return {
        request() {
          const now = Date.now()
          last = now
          if (timed.has(entry)) return
          first = now
          entry.due = now + Math.min(ms, maxWait)
          timed.add(entry)
          if (!timer || entry.due < timer.at) arm()
        },
        // the timer may then find nothing due; it arms itself again for what is left
        cancel: () => { timed.delete(entry) },
      }
    }
  }
}

/**
 * `fn` on a schedule: calling the returned function asks for a run, and the calls made before that
 * run are one run, with the arguments of the last call. For code outside render, such as a store's
 * socket handler that collects messages and publishes once per frame:
 *
 * ```ts
 * useEffect(() => {
 *   const levels = new Map<number, number>()
 *   const publish = scheduled(() => setBook(snapshotOf(levels)), 'frame')
 *   const off = socket.subscribe(symbol, delta => { apply(levels, delta); publish() })
 *   return () => { off(); publish.cancel() }
 * }, [symbol])
 * ```
 *
 * `cancel()` forgets a pending run; `flush()` makes a pending run now.
 */
export const scheduled = <A extends unknown[]>(fn: (...args: A) => void, schedule: Schedule) => {
  let args: A | undefined
  const task = createTask(planOf(schedule), () => {
    if (!args) return
    const current = args
    args = undefined
    fn(...current)
  })
  return Object.assign((...next: A) => {
    args = next
    task.request()
  }, {
    cancel() {
      args = undefined
      task.cancel()
    },
    flush() {
      if (!args) return
      task.cancel()
      const current = args
      args = undefined
      fn(...current)
    },
  })
}

/**
 * Run every pending scheduled run now, in one batch: frames, throttles, debounces, idle callbacks and
 * `scheduled` functions. Returns whether anything ran. For tests (react-state-custom/testing).
 */
export const flushAllScheduled = () => {
  const entries: Entry[] = []
  frame.cancel?.()
  frame.cancel = undefined
  frame.round = 0
  entries.push(...take(frame.entries))
  for (const clock of clocks.values()) {
    clock.cancel?.()
    clock.cancel = undefined
    clock.phase = 'idle'
    entries.push(...take(clock.pending))
  }
  timer?.cancel()
  timer = undefined
  entries.push(...take(timed))
  idle.cancel?.()
  idle.cancel = undefined
  idle.at = Infinity
  entries.push(...take(idle.entries))
  runAll(entries)
  return entries.length > 0
}

/** Forget every pending run without running it (between tests). */
export const cancelAllScheduled = () => {
  frame.cancel?.()
  frame.cancel = undefined
  frame.round = 0
  frame.entries.clear()
  for (const clock of clocks.values()) clock.cancel?.()
  clocks.clear()
  timer?.cancel()
  timer = undefined
  timed.clear()
  idle.cancel?.()
  idle.cancel = undefined
  idle.at = Infinity
  idle.entries.clear()
}
