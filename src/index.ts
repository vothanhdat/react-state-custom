export {
  Context,
  getContext,
  useDataContext,
  useDataSource,
  useDataSourceMultiple,
  useDataSubscribe,
  useDataSubscribeMultiple,
  useDataSubscribeMultipleWithDebounce,
  useDataSubscribeWithTransform,
  useDataSelector,
  acquireContext
} from "./state-utils/ctx"

export { createRootCtx } from "./state-utils/createRootCtx"
export { AutoRootCtx, createAutoCtx, createStore, StateScopeProvider, StoreErrorBoundary, type StoreOptions, type StoreParams, type StoreState, type StoreStateWith, type StoreHandle, type StoreStatus, type StoreReadOptions, type StoreSelectOptions, type StateDebugRenderer } from "./state-utils/createAutoCtx"
export { scheduled, type Schedule } from "./state-utils/schedule"
export { useFrameState } from "./state-utils/useFrameState"
export { formatState, shallowEqual } from "./state-utils/utils"
export { useArrayChangeId } from "./state-utils/useArrayChangeId"
export { paramsToId, type ParamsToIdRecord, type ParamsToIdInput, type ParamValue, type StoreParamsShape } from "./state-utils/paramsToId"

export { useQuickSubscribe } from "./state-utils/useQuickSubscribe"

// The dev tool lives in its own entry so the UI dependency and CSS never reach production bundles:
//   import { DevToolContainer } from "react-state-custom/dev-tool"
