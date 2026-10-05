import { useState, useSyncExternalStore, type SetStateAction } from "react"
import { createTask, planOf } from "./schedule"

/**
 * `useState` whose updates apply once per animation frame. Set it as often as messages arrive (a
 * socket, a sensor, a pointer): the updates of a frame are applied in order, and the component
 * renders once, in the frame, together with the components scheduled `'frame'`.
 *
 * In a store hook it publishes once per frame instead of once per message. The setter is stable.
 * An update is applied in the frame even if the component unmounted meanwhile; nothing renders then.
 */
export function useFrameState<T>(initial: T | (() => T)): [T, (action: SetStateAction<T>) => void]
export function useFrameState<T = undefined>(): [T | undefined, (action: SetStateAction<T | undefined>) => void]
export function useFrameState<T>(initial?: T | (() => T)) {
  const [state] = useState(() => frameState(typeof initial === "function" ? (initial as () => T)() : initial as T))
  const value = useSyncExternalStore(state.subscribe, state.get, state.get)
  return [value, state.set] as const
}

const frameState = <T,>(initial: T) => {
  let value = initial
  const updates: SetStateAction<T>[] = []
  const listeners = new Set<() => void>()
  const task = createTask(planOf("frame"), () => {
    let next = value
    for (const update of updates.splice(0)) next = typeof update === "function" ? (update as (prev: T) => T)(next) : update
    if (Object.is(next, value)) return
    value = next
    listeners.forEach(listener => listener())
  })
  return {
    get: () => value,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(update: SetStateAction<T>) {
      updates.push(update)
      task.request()
    },
  }
}
