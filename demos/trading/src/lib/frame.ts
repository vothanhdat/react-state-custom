// Market data arrives in bursts of tens or hundreds of messages a second. Publishing each one
// would mean one store commit and one consumer commit per message; the screen only changes once
// per frame, so the stores collect messages in plain objects and publish once per frame.

const request: (cb: () => void) => number =
  typeof requestAnimationFrame === 'function' ? cb => requestAnimationFrame(cb) : cb => setTimeout(cb, 16) as unknown as number
const cancel: (id: number) => void =
  typeof cancelAnimationFrame === 'function' ? id => cancelAnimationFrame(id) : id => clearTimeout(id)

/** Calls `flush` at most once per animation frame, however often `schedule` is called. Call `dispose` in the effect cleanup. */
export const frameScheduler = (flush: () => void) => {
  let id = 0
  return {
    schedule() {
      if (id) return
      id = request(() => { id = 0; flush() })
    },
    dispose() {
      cancel(id)
      id = 0
    },
  }
}
