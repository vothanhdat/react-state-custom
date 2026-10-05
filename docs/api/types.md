# Types

The types of the main API are exported from `react-state-custom`; `Scheduler` and `ScheduledTask` from `react-state-custom/schedulers`.

## `StoreState`

What `useStore` returns, and what `select` and `storeRef(params).get()` see: every key of `State` is optional, because it is `undefined` until the store has run once.

```ts
type StoreState<State> = { [K in keyof State]?: State[K] }
```

In 1.x it takes a second parameter, the keys of the deprecated `initialState`, which it types as always present.

## `StoreRef`

Returned by `storeRef(params)`. See [`storeRef`](/api/create-store#storeref-params).

```ts
type StoreRef<State> = {
  readonly name: string            // "name?params"
  readonly ready: boolean          // the running instance has published at least once; false once it is torn down
  readonly error: unknown          // what the hook threw while the instance is disabled, else undefined
  get(): StoreState<State>
  subscribe(listener: (state: StoreState<State>, changedKey: keyof State) => void): () => void
  retain(): () => void
}
```

- `get()` never subscribes and never starts a store. Before anything runs the instance it returns `{}`.
- `subscribe()` keeps the context alive while subscribed and fires once per changed key. All calls of one store update get the same snapshot object, the complete new state: all keys of the update are applied before the first call. Treat it as read-only; the next update gets a new one. The listener must not throw: an error thrown by any subscriber is rethrown to the store that published the change, and its error boundary disables that store.
- `retain()` runs the instance through the global `AutoRootCtx` and counts as a reader. Call the returned function to release. Logs a development error if no `AutoRootCtx` is mounted within a second.

## `StatesOf`

What `useMultipleStore(refs)` returns: the `StoreState` of each ref, in order. A tuple of refs gives a tuple, an array gives an array.

```ts
type StatesOf<Refs extends readonly StoreRef<any>[]> = { -readonly [K in keyof Refs]: /* StoreState of Refs[K] */ }
```

## `StoreOptions`

The options of `createStore`.

```ts
type StoreOptions = {
  timeToClean?: number
  schedule?: Scheduler
}
```

In 1.x it also takes the deprecated `initialState` and `AttachedComponent`.

## `StoreReadOptions` / `StoreSelect`

The options of `useStore` and `useMultipleStore`.

```ts
type StoreReadOptions = { schedule?: Scheduler }     // useStore(params, options)
type StoreSelect<S, R> = {                           // useStore(params, { select, ... })
  select: (state: S) => R
  isEqual?: (a: R, b: R) => boolean                   // default shallowEqual
  schedule?: Scheduler
}
```

`StoreSelectOptions<R>`, `StoreSelect` without `select`, is what the deprecated `useStore(params, selector, options)` takes.

## `Scheduler` / `ScheduledTask`

What the `schedule` options take: made by `sync()`, `frame()`, `throttle(ms)`, `debounce(ms, { maxWait })` and `idle(ms)`, or written by you. See [Schedulers](/api/schedulers).

```ts
type Scheduler = { readonly name: string, task(run: () => void): ScheduledTask }
type ScheduledTask = { request(): void, cancel(): void }
```

## `StoreParams`

The argument list of `useStore` and `storeRef`: `[params?: Params]` when `Params` has no required keys, `[params: Params]` otherwise.

Every value of the params must be a primitive (`string`, `number`, `bigint`, `boolean`, `null` or `undefined`), so the identity of an instance is deterministic. The constraint is written over the keys of the params type, so an `interface` qualifies as well as a `type`.

## `Store`

What `createStore` returns: `Store<Params, State>`.

## Deprecated

Removed in 2.0, with the APIs that use them.

- `StoreHandle`: renamed `StoreRef`.
- `StoreStatus`: what `useStoreStatus` returns, `{ ready, failed, error }`.
- `StoreStateWith`: what `useStoreSuspense(params, keys)` returns.
- `StateDebugRenderer`: the component the `debugging` prop of `AutoRootCtx` takes.
- `StoreParamsShape`, `ParamValue`, `ParamsToIdRecord`, `ParamsToIdInput`: the params constraint and what `paramsToId` takes. They become internal.
