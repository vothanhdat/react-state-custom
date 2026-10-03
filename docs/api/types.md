# Types

All types are exported from the package entry.

## `StoreHandle`

Returned by `getStore(params)`.

```ts
type StoreHandle<State, Initial> = {
  readonly name: string            // "name?params"
  readonly ready: boolean          // the store hook has published at least once
  get(): StoreState<State, Initial>
  subscribe(listener: (state: StoreState<State, Initial>, changedKey: keyof State) => void): () => void
  retain(): () => void
}
```

- `get()` never subscribes and never creates a store. It returns `initialState` merged with the live data, or `initialState` (or `{}`) before anything has run.
- `subscribe()` keeps the context alive while subscribed and fires once per changed key with a fresh snapshot. The listener must not throw: an error thrown by any subscriber is rethrown to the store that published the change, and its error boundary disables that store.
- `retain()` mounts the store through the global `AutoRootCtx` and counts as a consumer. Call the returned function to release. Logs a development error if no `AutoRootCtx` is mounted within a second.

## `StoreOptions`

```ts
type StoreOptions<Params, State, Initial extends Partial<State> = {}> = {
  timeToClean?: number
  AttachedComponent?: React.ComponentType<Params>
  initialState?: Initial | ((params: Params) => Initial)
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

## `ParamsToIdRecord` / `ParamsToIdInput`

Constraint for store parameters. All values must be primitives so the identity is deterministic. `ParamsToIdInput` additionally allows `undefined` for the whole object.

```ts
type ParamsToIdRecord = Record<string, string | number | bigint | boolean | null | undefined>
type ParamsToIdInput = ParamsToIdRecord | undefined
```
