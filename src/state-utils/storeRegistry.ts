import type { StoreRef } from "./createAutoCtx"
import type { Scheduler } from "./schedule"

/**
 * What `react-state-custom/testing` needs to reach a store from one of the functions `createStore`
 * returned (`useStore`, `storeRef`). Filled by createStore; only the testing entry reads it.
 */
export type StoreEntry = {
  /** The name given to createStore. */
  name: string
  storeRef: (params?: object) => StoreRef<any>
}

export const storeEntries = new WeakMap<Function, StoreEntry>()

/**
 * Hooks that run in place of a store's own hook, by store name: the test doubles of `mockStore`.
 * An instance looks here once, when it starts. Empty unless the testing entry is used.
 */
export const storeMocks = new Map<string, (params: any) => object>()

/** What `useMultipleStore` needs from a ref to read and run its instance, as `useStore` does. */
export type StoreRefTarget = {
  /** Context name of the instance, `name?params`. */
  name: string
  /** Run the instance in AutoRootCtx and keep its context until the release function is called. */
  retain(): () => void
  /** The store's `schedule` option. */
  schedule: Scheduler | undefined
}

/** The target of every ref `storeRef(params)` made. */
export const storeRefs = new WeakMap<object, StoreRefTarget>()
