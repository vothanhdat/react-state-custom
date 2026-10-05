import type { StoreHandle } from "./createAutoCtx"

/**
 * What `react-state-custom/testing` needs to reach a store from one of the functions `createStore`
 * returned (`useStore`, `getStore`, ...). Filled by createAutoCtx; only the testing entry reads it.
 */
export type StoreEntry = {
  /** The name given to createStore. */
  name: string
  getStore: (params?: object) => StoreHandle<any, any>
}

export const storeEntries = new WeakMap<Function, StoreEntry>()

/**
 * Hooks that run in place of a store's own hook, by store name: the test doubles of `mockStore`.
 * An instance looks here once, when it starts. Empty unless the testing entry is used.
 */
export const storeMocks = new Map<string, (params: any, preState: any) => object>()
