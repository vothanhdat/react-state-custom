import type { Context } from "./ctx"
import type { StoreRef } from "./createAutoCtx"
import type { Scheduler } from "./schedule"

/**
 * What `react-state-custom/testing` needs to reach a store from one of the functions `createStore`
 * returned (`useStore`, `storeRef`, ...). Filled by createAutoCtx; only the testing entry reads it.
 */
export type StoreEntry = {
  /** The name given to createStore. */
  name: string
  getStore: (params?: object) => StoreRef<any, any>
}

export const storeEntries = new WeakMap<Function, StoreEntry>()

/**
 * Hooks that run in place of a store's own hook, by store name: the test doubles of `mockStore`.
 * An instance looks here once, when it starts. Empty unless the testing entry is used.
 */
export const storeMocks = new Map<string, (params: any, preState: any) => object>()

/** What `useMultipleStore` needs from a ref to read and run its instance, as `useStore` does. */
export type StoreRefTarget = {
  /** Context name of the instance, `name?params`, before any scope prefix. */
  name: string
  /** Prepare the instance's context during render, before anything reads it (puts in `initialState`). */
  prepare(ctx: Context<any>): void
  /** Run the instance in the scope's AutoRootCtx and keep its context until the release function is called. */
  retain(scopeId: string | null): () => void
  /** What the server rendered for the instance, read while hydrating. */
  server(): object
  /** The store's `schedule` option. */
  schedule: Scheduler | undefined
}

/** The target of every ref `storeRef(params)` made. */
export const storeRefs = new WeakMap<object, StoreRefTarget>()
