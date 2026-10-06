// The API: createStore, which returns useStore and storeRef; useMultipleStore; AutoRootCtx.
// Schedulers for the `schedule` option: react-state-custom/schedulers.
export {
  AutoRootCtx,
  createStore,
  type Store,
  type StoreOptions,
  type StoreParams,
  type StoreState,
  type StoreRef,
  type StoreReadOptions,
  type StoreSelect,
  type UseStore,
} from "./state-utils/createAutoCtx"
export { useMultipleStore, type StatesOf } from "./state-utils/useMultipleStore"

// The dev tool lives in its own entry so the UI dependency and CSS never reach production bundles:
//   import { DevToolContainer } from "react-state-custom/dev-tool"
// The testing helpers live in theirs:
//   import { mockStore, resetStores, storeHandle, waitForStore } from "react-state-custom/testing"
