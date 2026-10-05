# Types

All types are exported from the package entry.

## `StoreHandle`

Returned by `getStore(params)`.

```ts
type StoreHandle<State, Initial> = {
  readonly name: string            // "name?params"
  readonly ready: boolean          // the running instance has published at least once; false once it is torn down
  readonly error: unknown          // what the hook threw while the instance is disabled, else undefined
  get(): StoreState<State, Initial>
  subscribe(listener: (state: StoreState<State, Initial>, changedKey: keyof State) => void): () => void
  retain(): () => void
}
```

- `get()` never subscribes and never creates a store. It returns `initialState` merged with the live data, or `initialState` (or `{}`) before anything has run.
- `subscribe()` keeps the context alive while subscribed and fires once per changed key. All calls of one store update get the same snapshot object, the complete new state: all keys of the update are applied before the first call. Treat it as read-only; the next update gets a new one. The listener must not throw: an error thrown by any subscriber is rethrown to the store that published the change, and its error boundary disables that store.
- `retain()` mounts the store through the global `AutoRootCtx` and counts as a consumer. Call the returned function to release. Logs a development error if no `AutoRootCtx` is mounted within a second.

## `StoreStatus`

Returned by `useStoreStatus(params)`.

```ts
type StoreStatus = {
  readonly ready: boolean   // the running instance has published at least once; false once it is torn down
  readonly failed: boolean  // the store hook threw and the instance is disabled until it is torn down
  readonly error: unknown   // what the hook threw, while failed
}
```

`failed` is kept apart from `error` because a hook can throw `undefined`. The object is the same from one render to the next until the status changes.

## `StoreOptions`

```ts
type StoreOptions<Params, State, Initial = {}> = {
  timeToClean?: number
  AttachedComponent?: React.ComponentType<Params>
  initialState?: Initial | ((params: Params) => Initial)
  schedule?: Schedule
}
```

`createStore` passes `Pick<State, Seeded>` as `Initial`, with `Seeded` inferred from the keys of `initialState`.

## `Schedule`

When a reader re-renders for a change of a store (the `schedule` option of `useStore` and `createStore`), or when a [`scheduled`](/api/primitives#scheduled) function runs.

```ts
type Schedule =
  | 'sync'                                  // at once (default)
  | 'frame'                                 // once per animation frame
  | { throttle: number }                    // at once, then at most once every ms, the last change included
  | { debounce: number, maxWait?: number }  // once changes stop for ms; at least every maxWait (default 1000, or ms when longer)
  | { idle: number }                        // when the browser is idle, at most ms later
```

`0` ms means `'sync'`. A value that is not a schedule logs a development error and renders at once. See [Update cadence](/guide/update-cadence).

## `StoreReadOptions` / `StoreSelectOptions`

The last argument of `useStore`.

```ts
type StoreReadOptions = { schedule?: Schedule }                // useStore(params, options)
type StoreSelectOptions<R> = StoreReadOptions & {              // useStore(params, selector, options)
  isEqual?: (a: R, b: R) => boolean
}
```

## `StoreParams`

The argument list of `useStore` / `useCtxState` / `getStore`: `[params?: Params]` when `Params` has no required keys, `[params: Params]` otherwise.

## `StoreState`

What `useStore` returns: every key of `State` is optional (it is `undefined` until the hook runs), except the keys present in `Initial`, which are always defined.

```ts
type StoreState<State, Initial> =
  { [K in keyof State]?: State[K] } & { [K in keyof Initial & keyof State]: State[K] }
```

## `StoreStateWith`

What `useStoreSuspense(params, keys)` returns when `keys` is a tuple, written in the call or kept `as const`: the listed keys hold a value, the others are as in `StoreState`. A widened array, such as `(keyof State)[]`, does not say which keys it holds, so the result is `StoreState`.

```ts
type StoreStateWith<State, Initial, K extends keyof State> =
  StoreState<State, Initial> & { [P in K]-?: Exclude<State[P], undefined> }
```

## `StoreParamsShape` / `ParamValue`

Constraint for store parameters: every value must be a primitive so the identity is deterministic. It is written over the keys of the params type, so an `interface` qualifies as well as a `type`.

```ts
type ParamValue = string | number | bigint | boolean | null | undefined
type StoreParamsShape<Params> = { [K in keyof Params]: ParamValue }
// createStore<Params extends StoreParamsShape<Params>, State extends object, ...>
```

## `ParamsToIdRecord` / `ParamsToIdInput`

What `paramsToId` accepts. `ParamsToIdInput` additionally allows `undefined` for the whole object.

```ts
type ParamsToIdRecord = Record<string, ParamValue>
type ParamsToIdInput = ParamsToIdRecord | undefined
```
