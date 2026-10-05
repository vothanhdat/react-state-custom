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
  type StoreSelectOptions,
} from "./state-utils/createAutoCtx"
export { useMultipleStore, type StatesOf } from "./state-utils/useMultipleStore"

// Everything below is deprecated and leaves the package in 2.0: see the migration guide,
// https://vothanhdat.github.io/react-state-custom/docs/guide/migrating-to-2

export {
  /** @deprecated Removed in 2.0, with scopes: put what tells instances apart in the params. */
  StateScopeProvider,
  /** @deprecated Removed in 2.0: each store keeps its own error boundary, and its error shows in the components reading it. */
  StoreErrorBoundary,
  /** @deprecated Removed in 2.0: use `createStore(name, useFn, options)`. */
  createAutoCtx,
  /** @deprecated Renamed `StoreRef`. */
  type StoreHandle,
  /** @deprecated Removed in 2.0, with `useStoreStatus`. */
  type StoreStatus,
  /** @deprecated Removed in 2.0, with `useStoreSuspense`. */
  type StoreStateWith,
  /** @deprecated Removed in 2.0, with the `debugging` prop of `AutoRootCtx`. */
  type StateDebugRenderer,
} from "./state-utils/createAutoCtx"

export {
  /** @deprecated Removed in 2.0: use `createStore(name, useFn, options)`. */
  createRootCtx,
} from "./state-utils/createRootCtx"

export {
  /** @deprecated Internal from 2.0: read stores with `useStore` or `useMultipleStore`, and outside React with `storeRef(params)`. */
  Context,
  /** @deprecated Internal from 2.0: use `storeRef(params)` outside React. */
  getContext,
  /** @deprecated Internal from 2.0: use `storeRef(params).retain()` outside React. */
  acquireContext,
  /** @deprecated Internal from 2.0: read stores with `useStore`. */
  useDataContext,
  /** @deprecated Internal from 2.0: a store publishes what its hook returns. */
  useDataSource,
  /** @deprecated Internal from 2.0: a store publishes what its hook returns. */
  useDataSourceMultiple,
  /** @deprecated Internal from 2.0: read stores with `useStore`. */
  useDataSubscribe,
  /** @deprecated Internal from 2.0: read stores with `useStore`. */
  useDataSubscribeMultiple,
  /** @deprecated Internal from 2.0: read stores with `useStore(params, { schedule })`. */
  useDataSubscribeMultipleWithDebounce,
  /** @deprecated Internal from 2.0: use `useStore(params, { select })`. */
  useDataSubscribeWithTransform,
  /** @deprecated Internal from 2.0: use `useStore(params, { select })`. */
  useDataSelector,
} from "./state-utils/ctx"

export {
  /** @deprecated Internal from 2.0: read stores with `useStore`. */
  useQuickSubscribe,
} from "./state-utils/useQuickSubscribe"

export {
  /** @deprecated Internal from 2.0. */
  useArrayChangeId,
} from "./state-utils/useArrayChangeId"

export {
  /** @deprecated Internal from 2.0: `storeRef(params).name` is the instance's id. */
  paramsToId,
  /** @deprecated Internal from 2.0. */
  type ParamsToIdRecord,
  /** @deprecated Internal from 2.0. */
  type ParamsToIdInput,
  /** @deprecated Internal from 2.0. */
  type ParamValue,
  /** @deprecated Internal from 2.0. */
  type StoreParamsShape,
} from "./state-utils/paramsToId"

export {
  /** @deprecated Removed in 2.0: `{ select }` compares with it by default. */
  shallowEqual,
  /** @deprecated Removed in 2.0, with the `debugging` prop of `AutoRootCtx`. */
  formatState,
} from "./state-utils/utils"

export {
  /** @deprecated Import it from `react-state-custom/schedulers`; it leaves the main entry in 2.0. */
  scheduled,
  /** @deprecated Import it from `react-state-custom/schedulers`; it leaves the main entry in 2.0. */
  sync,
  /** @deprecated Import it from `react-state-custom/schedulers`; it leaves the main entry in 2.0. */
  type Scheduler,
  /** @deprecated Import it from `react-state-custom/schedulers`; it leaves the main entry in 2.0. */
  type ScheduledTask,
} from "./state-utils/schedule"

export {
  /** @deprecated Import it from `react-state-custom/schedulers`; it leaves the main entry in 2.0. */
  frame,
  /** @deprecated Import it from `react-state-custom/schedulers`; it leaves the main entry in 2.0. */
  throttle,
  /** @deprecated Import it from `react-state-custom/schedulers`; it leaves the main entry in 2.0. */
  debounce,
  /** @deprecated Import it from `react-state-custom/schedulers`; it leaves the main entry in 2.0. */
  idle,
} from "./state-utils/schedulers"

export {
  /** @deprecated Import it from `react-state-custom/schedulers`; it leaves the main entry in 2.0. */
  useFrameState,
} from "./state-utils/useFrameState"

// The dev tool lives in its own entry so the UI dependency and CSS never reach production bundles:
//   import { DevToolContainer } from "react-state-custom/dev-tool"
