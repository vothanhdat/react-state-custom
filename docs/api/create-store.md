# createStore

The main entry point. Converts a standard React hook into a shared, automatically managed store.

```ts
function createStore<Params, State, Initial extends Partial<State> = {}>(
  name: string,
  useFn: (params: Params, preState: Partial<State>) => State,
  options?: number | StoreOptions<Params, State, Initial>
): {
  useStore(params?: Params): StoreState<State, Initial>
  useStore<R>(
    params: Params | undefined,
    selector: (state: StoreState<State, Initial>) => R,
    isEqual?: (a: R, b: R) => boolean
  ): R
  useStoreSuspense(params?: Params, isReady?: (state: StoreState<State, Initial>) => boolean): State
  getStore(params?: Params): StoreHandle<State, Initial>
  useCtxState(params?: Params): Context<State>
}
```

`params` is optional on every returned function when `Params` has no required keys.

## Arguments

### `name`

A unique namespace for this store, for example `'user'` or `'cart'`. Two `createStore` calls with the same name share contexts, so keep names unique per application.

### `useFn`

Your hook. Receives `params` and `preState`, the values previously published by an instance with the same identity (useful to warm-start after a remount; an empty object otherwise). Its return value is the store state: every key is published separately, and functions get a stable identity across store renders.

### `options`

An object, or a bare number treated as `timeToClean`.

| option | type | default | description |
|---|---|---|---|
| `timeToClean` | `number` | `0` | Milliseconds to keep the instance alive after its last consumer or retainer leaves. |
| `initialState` | `Initial \| (params) => Initial` | | Values consumers read before the hook has published. Keys listed here are typed as always present. |
| `AttachedComponent` | `ComponentType<Params>` | | Rendered next to each instance, inside its error boundary, with the store params as props. |

See [Store options](/guide/store-options) for guidance.

## Returns

### `useStore(params?)`

The consumer hook. Returns a proxy that records which keys the component reads during render and subscribes to exactly those. The proxy is a new object on every render. Reads outside render return the current value, are not tracked, and log a development warning. The proxy is read-only: writing to it throws in development. See [Reads outside render](/guide/reads-outside-render).

### `useStore(params, selector, isEqual?)`

Returns `selector(state)` and re-renders only when that value changes (`Object.is` unless `isEqual` is given). The selector receives the plain state object. A new selector function each render is fine. Pass `undefined` as `params` for stores without params. See [Selectors](/guide/selectors).

### `useStoreSuspense(params?, isReady?)`

Suspends for the nearest `<Suspense>` until the hook has published once, or until `isReady(state)` returns true when given. Returns the full `State` type. The store is retained while the component is suspended. On the server it throws unless `initialState` already satisfies `isReady`. See [Suspense](/guide/suspense).

### `getStore(params?)`

Imperative handle for code outside React: `get()`, `subscribe()`, `retain()`, `ready`, `name`. Global scope only. See [`StoreHandle`](/api/types#storehandle) and [Outside React](/guide/outside-react).

### `useCtxState(params?)`

Returns the raw `Context` object for the instance in the current scope, and asks the scope's root to mount the store. Use it to subscribe imperatively inside a `StateScopeProvider`, or for custom integrations. See [`Context`](/api/primitives#context).

## Example

```ts
const useCounter = ({ initial = 0 }: { initial?: number }) => {
  const [count, setCount] = useState(initial)
  return { count, setCount }
}

export const { useStore, getStore } = createStore('counter', useCounter, {
  initialState: { count: 0 },
  timeToClean: 5000,
})
```

## Relation to the primitives

`createStore(name, useFn, options)` is `createAutoCtx(createRootCtx(name, useFn), options)`. See [Primitives](/api/primitives).
