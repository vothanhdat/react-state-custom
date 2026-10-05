import { isProduction } from "./utils"

/** One requested run of a function on a schedule. */
export type ScheduledTask = {
  /** Ask for a run. Requests made before the run happens are one run. */
  request(): void
  /** Forget a requested run that has not happened yet. */
  cancel(): void
}

/**
 * When a reader re-renders for a change of the store it reads (the `schedule` option of `useStore`
 * and `createStore`), or when a `scheduled` function runs. Made by `sync()`, `frame()`,
 * `throttle(ms)`, `debounce(ms, { maxWait })` and `idle(ms)`, which are imported only where used,
 * so an app that schedules nothing ships none of them.
 *
 * `task(run)` returns a task that runs `run` when the schedule says. Readers compare schedulers by
 * identity: the factories return the same object for the same arguments, and a scheduler of your
 * own should be created once, outside render.
 */
export type Scheduler = {
  /** For messages: `frame()`, `throttle(100)`, ... */
  readonly name: string
  task(run: () => void): ScheduledTask
}

const noop = () => { }

/** The default: run at once. Readers on it skip the scheduler entirely. */
export const SYNC: Scheduler = Object.freeze({
  name: "sync()",
  task: (run: () => void): ScheduledTask => ({ request: run, cancel: noop }),
})

/** Re-render at once, in the commit after the change: the default. Use it to override a store's `schedule`. */
export const sync = (): Scheduler => SYNC

const warned = new Set<string>()

/** The scheduler to use for `schedule`: a value that is not one logs a development error and runs sync. */
export const schedulerOf = (schedule: Scheduler | undefined): Scheduler => {
  if (schedule === undefined) return SYNC
  if (typeof schedule === "object" && schedule !== null && typeof schedule.task === "function") return schedule
  if (!isProduction) {
    const text = typeof schedule === "object" && schedule !== null ? JSON.stringify(schedule) : String(schedule)
    if (!warned.has(text)) {
      warned.add(text)
      console.error(
        `[react-state-custom] ${text} is not a schedule. Import one: sync(), frame(), throttle(ms), ` +
        `debounce(ms, { maxWait }) or idle(ms) from react-state-custom/schedulers. Rendering at once instead.`
      )
    }
  }
  return SYNC
}

/** A scheduled function, as the queues of the schedulers hold it. */
export type Entry = { run: () => void }

/** Run every entry, then rethrow the first error: one that throws must not keep the others waiting. */
export const runAll = (entries: Iterable<Entry>) => {
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

/** The pending runs of a scheduler, as react-state-custom/testing reaches them. */
export type Queue = {
  /** Remove every pending run and return it, stopping the queue's timers. */
  take(): Entry[]
}

/** Queues that have held a run. A scheduler adds its queue when it is first used, so none ship unused. */
const queues = new Set<Queue>()

export const registerQueue = (queue: Queue) => { queues.add(queue) }

/**
 * Run every pending scheduled run now, in one batch. Returns whether anything ran.
 * For tests (react-state-custom/testing).
 */
export const flushAllScheduled = () => {
  const entries: Entry[] = []
  for (const queue of queues) entries.push(...queue.take())
  runAll(entries)
  return entries.length > 0
}

/** Forget every pending run without running it (between tests). */
export const cancelAllScheduled = () => {
  for (const queue of queues) queue.take()
}

/**
 * `fn` on a schedule: calling the returned function asks for a run, and the calls made before that
 * run are one run, with the arguments of the last call. For code outside render, such as a store's
 * socket handler that collects messages and publishes once per frame:
 *
 * ```ts
 * useEffect(() => {
 *   const levels = new Map<number, number>()
 *   const publish = scheduled(() => setBook(snapshotOf(levels)), frame())
 *   const off = socket.subscribe(symbol, delta => { apply(levels, delta); publish() })
 *   return () => { off(); publish.cancel() }
 * }, [symbol])
 * ```
 *
 * `cancel()` forgets a pending run; `flush()` makes a pending run now.
 */
export const scheduled = <A extends unknown[]>(fn: (...args: A) => void, schedule: Scheduler) => {
  let args: A | undefined
  const task = schedulerOf(schedule).task(() => {
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
