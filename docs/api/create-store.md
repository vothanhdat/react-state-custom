# createStore

Turns a hook into a store: one running instance per params, started by its first reader, shared by every reader, and stopped `timeToClean` milliseconds after the last one leaves.

```ts
function createStore<Params, State>(
  name: string,
  useFn: (params: Params) => State,
  options?: { timeToClean?: number, schedule?: Scheduler }
): {
  useStore(params?: Params, options?: { schedule?: Scheduler }): StoreState<State>
  useStore<R>(
    params: Params | undefined,
    options: { select: (state: StoreState<State>) => R, isEqual?: (a: R, b: R) => boolean, schedule?: Scheduler }
  ): R
  storeRef(params?: Params): StoreRef<State>
}
```

`params` is optional on every returned function when `Params` has no required keys. Read several instances in one component with [`useMultipleStore`](/api/use-multiple-store).

## Arguments

### `name`

A unique namespace for this store, for example `'user'` or `'cart'`. Two `createStore` calls with the same name share contexts, so keep names unique per application.

### `useFn`

Your hook. It receives `params` and its return value is the store state: every key is published separately, and functions get a stable identity across store renders. It may call any hook, other stores' `useStore` and `useMultipleStore` included.

### `options`

| option | type | default | description |
|---|---|---|---|
| `timeToClean` | `number` | `0` | Milliseconds to keep the instance alive after its last reader or retainer leaves. `Infinity` keeps it until `AutoRootCtx` unmounts. |
| `schedule` | [`Scheduler`](/api/schedulers) | `sync()` | When readers re-render for a change, unless they pass their own `schedule`. See [Update cadence](/guide/update-cadence). |

There are no other options. See [Store options](/guide/store-options) for guidance.

## Returns

### `useStore(params?, options?)`

The reader hook. Returns a proxy that records which keys the component reads during render and subscribes to exactly those.

Every key is `undefined` until the store has run once, and the type says so: a store starts when its first reader asks for it, so the first render of that reader never has its values. Default at the read (`count ?? 0`) or render a loading state. See [Before the data arrives](/guide/getting-started#before-the-data-arrives).

- The proxy is a new object on every render.
- Reads outside render return the current value, are not tracked, and log a development warning. See [Reads outside render](/guide/reads-outside-render).
- The proxy is read-only: writing to it throws in development.
- `options.schedule` says when the component re-renders for a change: a [scheduler](/api/schedulers) such as `frame()`, `throttle(ms)`, `debounce(ms)` or `idle(ms)`. By default it follows the store's `schedule` option, or re-renders at once. See [Update cadence](/guide/update-cadence).

A store without params takes `undefined` as `params` when options follow: `useStore(undefined, { schedule: frame() })`. Passed alone, the options object would be read as params; a development error says so.

### `useStore(params, { select, isEqual?, schedule? })`

Returns `select(state)` and re-renders only when that value changes. `select` receives the plain state object, so it may read as deep as it likes. A new `select` function on every render is fine.

`isEqual` decides whether the selection changed. It defaults to a shallow comparison, `Object.is` one level deep, so a fresh array or object with the same items is no change. Pass `Object.is` to compare by identity, or your own function.

A call site must pass `select` on every render or on none: the two forms run different hooks, and a development error says so. See [Selectors](/guide/selectors).

### `storeRef(params?)`

One instance of the store, for code outside React (socket handlers, routers, tests), for an event handler that wants the latest value without subscribing, and for [`useMultipleStore`](/api/use-multiple-store).

```ts
type StoreRef<State> = {
  readonly name: string     // "name?params"
  readonly ready: boolean   // the instance has published at least once
  readonly error: unknown   // what the hook threw while the instance is disabled
  get(): StoreState<State>
  subscribe(listener: (state: StoreState<State>, changedKey: keyof State) => void): () => void
  retain(): () => void
}
```

- `get()` returns a plain snapshot of the current state. It never subscribes and never starts the store: before anything runs the instance, it is `{}`.
- `subscribe(listener)` runs `listener` after every change, with the new snapshot and the key that changed. It keeps the instance's context while subscribed.
- `retain()` runs the instance even while no component reads it, until the returned function is called. The instance stops `timeToClean` after every reader and retainer is gone.

A ref is a description of an instance, not a resource: making one is cheap, and two refs with the same params point at the same instance. See [`StoreRef`](/api/types#storeref) and [Outside React](/guide/outside-react).

## Example

```ts
const useCounter = ({ initial = 0 }: { initial?: number }) => {
  const [count, setCount] = useState(initial)
  return { count, setCount }
}

export const { useStore: useCounterStore, storeRef: counterRef } = createStore('counter', useCounter, {
  timeToClean: 5000,
})

// in a component
const { count } = useCounterStore({ initial: 1 })
const doubled = useCounterStore({ initial: 1 }, { select: s => (s.count ?? 0) * 2 })

// outside React
counterRef({ initial: 1 }).get().setCount?.(10)
```

## Errors

A store hook that throws, during render or in an effect, disables its instance until the instance is torn down; every other store keeps running. The components reading the instance, through `useStore` or `useMultipleStore`, throw its error for their own error boundary, and `storeRef(params).error` holds it. Once nothing reads or retains it, the failed instance is torn down at once, whatever its `timeToClean`, and the next reader starts a fresh one. See [Error handling](/guide/error-handling).
