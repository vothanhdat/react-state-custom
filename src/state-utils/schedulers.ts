import { isProduction } from "./utils"
import { registerQueue, runAll, SYNC, type Entry, type ScheduledTask, type Scheduler } from "./schedule"

// The schedulers, each a factory imported where it is used. Every run due at the same moment (one
// frame, one throttle tick, one debounce timer, one idle callback) happens in one batch, so React
// renders all of it in one commit.

/** The longest delay `setTimeout` waits; a longer one runs at once. */
const MAX_TIMEOUT = 2 ** 31 - 1

/** Timers fire up to a millisecond early in some environments: a run this close to its time is due. */
const SLACK = 1

/** A debounce renders at least this often while changes go on: a stream never pauses, and would never render. */
const DEFAULT_MAX_WAIT = 1000

const later = (fn: () => void, ms: number) => {
  const id = setTimeout(fn, Math.min(Math.max(ms, 0), MAX_TIMEOUT))
  return () => clearTimeout(id)
}

// Looked up at each call, not at load, so test environments can fake them.
const nextFrame = (fn: () => void) => {
  if (typeof requestAnimationFrame !== "function") return later(fn, 16)
  const id = requestAnimationFrame(fn)
  return () => cancelAnimationFrame(id)
}

const whenIdle = (fn: () => void, timeout: number) => {
  if (typeof requestIdleCallback !== "function" || typeof cancelIdleCallback !== "function") return later(fn, timeout)
  const id = requestIdleCallback(fn, { timeout: Math.min(timeout, MAX_TIMEOUT) })
  return () => cancelIdleCallback(id)
}

const take = <T,>(set: Set<T>) => {
  const items = [...set]
  set.clear()
  return items
}

/** Schedulers made so far, by name: equal arguments give the same object, so readers see no change. */
const made = new Map<string, Scheduler>()

const shared = (name: string, task: (run: () => void) => ScheduledTask): Scheduler => {
  let scheduler = made.get(name)
  if (!scheduler) made.set(name, scheduler = Object.freeze({ name, task }))
  return scheduler
}

/**
 * A number of milliseconds (a delay longer than a timer can wait capped to the longest one), or
 * undefined after logging a development error when `value` is not one.
 */
const msOf = (factory: string, value: unknown, cap = MAX_TIMEOUT) => {
  if (typeof value === "number" && value >= 0) return Math.min(value, cap)
  if (!isProduction) {
    console.error(
      `[react-state-custom] ${factory}(${String(value)}): expected a number of milliseconds, 0 or more. Rendering at once instead.`
    )
  }
  return undefined
}

// ---------------------------------------------------------------------------------------- frame

/**
 * What a frame's runs render can schedule more for the frame: a store reading a frame-scheduled
 * source publishes, and its frame-scheduled readers ask for a frame. React renders those updates in
 * a microtask queued while the runs notified it, so a microtask queued after the runs comes after
 * that render: it runs what it scheduled, in the same frame. A few rounds at most, then next frame.
 */
const MAX_FRAME_ROUNDS = 8

const frameQueue = {
  entries: new Set<Entry>(),
  cancel: undefined as (() => void) | undefined,
  /** > 0 while a frame is running its entries, rounds included. */
  round: 0,
  take() {
    frameQueue.cancel?.()
    frameQueue.cancel = undefined
    frameQueue.round = 0
    return take(frameQueue.entries)
  },
}

const requestFrame = (entry: Entry) => {
  registerQueue(frameQueue)
  frameQueue.entries.add(entry)
  if (frameQueue.round === 0 && !frameQueue.cancel) frameQueue.cancel = nextFrame(onFrame)
}

const onFrame = () => {
  frameQueue.cancel = undefined
  frameQueue.round = 1
  drainFrame()
}

const drainFrame = () => {
  if (frameQueue.entries.size === 0) {
    frameQueue.round = 0
    return
  }
  const entries = take(frameQueue.entries)
  try {
    runAll(entries)
  } finally {
    if (frameQueue.round < MAX_FRAME_ROUNDS) {
      frameQueue.round++
      queueMicrotask(drainFrame)
    } else {
      frameQueue.round = 0
      if (frameQueue.entries.size > 0) frameQueue.cancel = nextFrame(onFrame)
    }
  }
}

const FRAME = Object.freeze({
  name: "frame()",
  task(run: () => void): ScheduledTask {
    const entry: Entry = { run }
    return { request: () => requestFrame(entry), cancel: () => { frameQueue.entries.delete(entry) } }
  },
})

/** Re-render once per animation frame, with the data of that frame. */
export const frame = (): Scheduler => FRAME

// ---------------------------------------------------------------------------------------- throttle

/**
 * The throttles of one `ms` share a clock: a run at once when the clock is idle (its first change
 * and every one made before the next microtask, so readers of one update render together), then the
 * changes in between every `ms` while there are some. A run for an entry that ran less than `ms` ago
 * therefore never happens: the clock goes idle only after a whole period with no change.
 */
type Clock = { ms: number, phase: "idle" | "leading" | "cooling", pending: Set<Entry>, cancel?: () => void }

const throttleQueue = {
  clocks: new Map<number, Clock>(),
  take() {
    const entries: Entry[] = []
    for (const clock of throttleQueue.clocks.values()) {
      clock.cancel?.()
      clock.cancel = undefined
      clock.phase = "idle"
      entries.push(...take(clock.pending))
    }
    return entries
  },
}

const requestThrottle = (ms: number, entry: Entry) => {
  registerQueue(throttleQueue)
  let clock = throttleQueue.clocks.get(ms)
  if (!clock) throttleQueue.clocks.set(ms, clock = { ms, phase: "idle", pending: new Set() })
  if (clock.phase === "cooling") {
    clock.pending.add(entry)
    return
  }
  if (clock.phase === "idle") {
    clock.phase = "leading"
    const started = clock
    queueMicrotask(() => {
      if (started.phase !== "leading") return
      started.phase = "cooling"
      started.cancel = later(() => tick(started), ms)
    })
  }
  entry.run()
}

const tick = (clock: Clock) => {
  clock.cancel = undefined
  if (clock.pending.size === 0) {
    clock.phase = "idle"
    return
  }
  const entries = take(clock.pending)
  clock.cancel = later(() => tick(clock), clock.ms)
  runAll(entries)
}

/** Re-render at once, then at most once every `ms` while changes go on, with the last of them. */
export const throttle = (ms: number): Scheduler => {
  const period = msOf("throttle", ms)
  if (!period) return SYNC
  return shared(`throttle(${period})`, run => {
    const entry: Entry = { run }
    return { request: () => requestThrottle(period, entry), cancel: () => { throttleQueue.clocks.get(period)?.pending.delete(entry) } }
  })
}

// ---------------------------------------------------------------------------------------- debounce

/** A debounced entry waiting for its time. `next` says when it is due after all, or `undefined` for now. */
type Timed = Entry & { due: number, next: (now: number) => number | undefined }

/** Every pending debounce, with one timer for the earliest: entries due together run in one batch. */
const debounceQueue = {
  timed: new Set<Timed>(),
  timer: undefined as { at: number, cancel: () => void } | undefined,
  take() {
    debounceQueue.timer?.cancel()
    debounceQueue.timer = undefined
    return take(debounceQueue.timed)
  },
}

const arm = () => {
  let at = Infinity
  for (const entry of debounceQueue.timed) if (entry.due < at) at = entry.due
  const { timer } = debounceQueue
  if (timer) {
    if (timer.at === at) return
    timer.cancel()
    debounceQueue.timer = undefined
  }
  if (at !== Infinity) debounceQueue.timer = { at, cancel: later(onTimer, at - Date.now()) }
}

const onTimer = () => {
  debounceQueue.timer = undefined
  const now = Date.now()
  const due: Timed[] = []
  for (const entry of debounceQueue.timed) {
    if (entry.due > now + SLACK) continue
    const next = entry.next(now)
    if (next === undefined) {
      debounceQueue.timed.delete(entry)
      due.push(entry)
    } else {
      entry.due = next
    }
  }
  arm()
  runAll(due)
}

/**
 * Re-render once changes stop for `ms`, and at least every `maxWait` while they go on: a stream
 * that never pauses still renders. `maxWait` defaults to 1000 ms, or `ms` when that is longer;
 * `Infinity` waits for a pause however long it takes.
 */
export const debounce = (ms: number, { maxWait }: { maxWait?: number } = {}): Scheduler => {
  const wait = msOf("debounce", ms)
  const cap = maxWait === undefined ? Math.max(wait ?? 0, DEFAULT_MAX_WAIT) : msOf("debounce", maxWait, Infinity)
  if (!wait || !cap) return SYNC
  return shared(`debounce(${wait}, { maxWait: ${cap} })`, run => {
    let first = 0
    let last = 0
    const entry: Timed = {
      run,
      due: 0,
      next(now) {
        const at = Math.min(last + wait, first + cap)
        // never further than one wait away, in case the clock went back
        return now + SLACK >= at ? undefined : Math.min(at, now + wait)
      },
    }
    return {
      request() {
        registerQueue(debounceQueue)
        const now = Date.now()
        last = now
        if (debounceQueue.timed.has(entry)) return
        first = now
        entry.due = now + Math.min(wait, cap)
        debounceQueue.timed.add(entry)
        if (!debounceQueue.timer || entry.due < debounceQueue.timer.at) arm()
      },
      // the timer may then find nothing due; it arms itself again for what is left
      cancel: () => { debounceQueue.timed.delete(entry) },
    }
  })
}

// ---------------------------------------------------------------------------------------- idle

const idleQueue = {
  entries: new Set<Entry>(),
  /** When the pending callback runs at the latest. */
  at: Infinity,
  cancel: undefined as (() => void) | undefined,
  take() {
    idleQueue.cancel?.()
    idleQueue.cancel = undefined
    idleQueue.at = Infinity
    return take(idleQueue.entries)
  },
}

const requestIdle = (ms: number, entry: Entry) => {
  registerQueue(idleQueue)
  if (idleQueue.entries.has(entry)) return
  idleQueue.entries.add(entry)
  const deadline = Date.now() + ms
  if (idleQueue.cancel && idleQueue.at <= deadline) return
  idleQueue.cancel?.()
  idleQueue.at = deadline
  idleQueue.cancel = whenIdle(onIdle, ms)
}

const onIdle = () => {
  idleQueue.cancel = undefined
  idleQueue.at = Infinity
  runAll(take(idleQueue.entries))
}

/**
 * Re-render when the browser is idle (`requestIdleCallback`), and at most `ms` after the change.
 * It moves a render out of the way of input and animation; it does not make it less frequent.
 */
export const idle = (ms: number): Scheduler => {
  const timeout = msOf("idle", ms)
  if (!timeout) return SYNC
  return shared(`idle(${timeout})`, run => {
    const entry: Entry = { run }
    return { request: () => requestIdle(timeout, entry), cancel: () => { idleQueue.entries.delete(entry) } }
  })
}
