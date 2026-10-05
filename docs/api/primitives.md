# Primitives

These exports are the layers underneath `createStore`. You do not need them for ordinary use; they are for custom abstractions, integrations and tests.

## `createRootCtx`

Creates a headless `Root` component that runs a hook and publishes its result to a context.

```ts
function createRootCtx<Params, State>(
  name: string,
  useFn: (params: Params, preState: Partial<State>) => State
): {
  Root: React.FC<Params>
  useCtxState(params?: Params): Context<State>        // logs an error if Root is not mounted
  useCtxStateStrict(params?: Params): Context<State>  // throws if Root is not mounted
  getCtxName(params: Params): string
  name: string
}
```

Mounting two `Root` components with the same name and params throws. `Root` publishes from a layout effect and marks the context ready after its first publish.

## `createAutoCtx`

Connects a `createRootCtx` result to the `AutoRootCtx` system for automatic mounting. `createStore` is `createAutoCtx(createRootCtx(name, useFn), options)`.

```ts
function createAutoCtx<Params, State, Initial>(
  rootCtx: ReturnType<typeof createRootCtx<Params, State>>,
  options?: number | StoreOptions<Params, State, Initial>
): ReturnType<typeof createStore<Params, State, Initial>>
```

## `Context`

The pub/sub primitive behind every store. It holds `data`, the latest value per key, and notifies subscribers of the changed key on `publish`.

```ts
class Context<T> extends EventTarget {
  readonly name: string
  data: Partial<T>
  readonly ready: boolean                                    // true once a store root has published
  readonly revision: number                                  // bumped on every publish, publishMany and touch
  publish<K extends keyof T>(key: K, value: T[K] | undefined): void
  subscribe<K extends keyof T>(key: K, listener: (value: T[K] | undefined) => void): () => void
  subscribeAll(listener: (changedKey: keyof T, data: Partial<T>) => void): () => void
  publishMany(entries: Iterable<[keyof T, T[keyof T]]>, removed?: Iterable<keyof T>): void
  touch(keys: Iterable<keyof T>): void                       // notify without a value change
  markReady(): void                                          // set ready and run onReady listeners once
  onReady(listener: () => void): () => void                  // run when ready (immediately if already)
  readonly failed: boolean                                   // the store hook threw and is disabled
  readonly error: unknown                                    // what it threw, while failed
  fail(error: unknown): void                                 // record a failure (listeners run in a microtask)
  recover(): void                                            // clear it: the failed instance was torn down
  onStatus(listener: () => void): () => void                 // run on fail and recover
}
```

- `publish` skips values equal by `Object.is`, calls the key's subscribers and then the `subscribeAll` listeners, and rethrows the first error a listener threw after every listener has run. A store publishes from a layout effect, so such an error reaches that store's `StoreErrorBoundary`.
- `publishMany` publishes several keys as one update: every value is assigned and every `removed` key deleted before any subscriber runs, so no subscriber sees a mix of new and old keys. A store publishes this way. A `subscribeAll` listener runs once per changed key, and `revision` is the same for all calls of one update: a listener that works on the whole data (a collection update changes every key) can skip the calls whose `revision` it has already handled, as the library's own readers do.
- `touch` notifies the subscribers of `keys` although their values are unchanged. A store calls it when a function it publishes got a new implementation behind its stable wrapper and a consumer calls that function while rendering.
- `subscribe` calls the listener right away when the key already has a value. The same function can be registered twice; each unsubscribe removes one registration.
- `Context` still extends `EventTarget` for compatibility, but no DOM events are dispatched.
- `registry` is deprecated and unused; it will be removed in 2.0.

## `getContext` / `acquireContext` / `useDataContext`

```ts
function getContext<T>(name: string): Context<T>                                 // memoized by name
function acquireContext<T>(name: string): { ctx: Context<T>; release: () => void } // ref-counted
function useDataContext<T>(name: string): Context<T>                              // hook form, scope-aware
```

- `getContext` returns the cached instance for a name, creating it if needed. `getContext.cache` is the underlying `Map`; `getContext.fromCache(name)` reads without creating. Clearing the cache between tests is a supported use; [`resetStores()`](/api/testing#resetstores) does it, and removes the mocks too. The cache is observable: `getContext.cache.subscribe(listener)` runs `listener` after every context creation or eviction (synchronously, possibly during a render) and returns an unsubscribe function. The dev tool uses it to list live stores.
- `acquireContext` is the non-hook counterpart of `useDataContext`: it keeps the context alive until `release()` is called. Used by `getStore` and `useStoreSuspense`.
- `useDataContext` resolves the name inside the current `StateScopeProvider`, keeps the instance alive while mounted, and lets it be evicted shortly after the last user unmounts. On the server it returns a throwaway instance.

## `useDataSource` / `useDataSourceMultiple`

Publish values from a component into a context. Publishing happens in a layout effect; a key that stops being passed to `useDataSourceMultiple` is published as `undefined` and removed.

```ts
useDataSource(ctx, 'key', value)
useDataSourceMultiple(ctx, ['key1', value1], ['key2', value2])
```

## `useDataSubscribe` / `useDataSubscribeMultiple`

Subscribe to specific context keys. Built on `useSyncExternalStore`.

```ts
const value = useDataSubscribe(ctx, 'key')
const value = useDataSubscribe(ctx, 'key', 100)                        // debounced 100 ms
const value = useDataSubscribe(ctx, 'key', 'frame')                    // any Schedule
const { key1, key2 } = useDataSubscribeMultiple(ctx, 'key1', 'key2')
const [key1, key2] = useDataSubscribeMultipleWithDebounce(ctx, 50, 'key1', 'key2')
```

A number of milliseconds is `{ debounce: ms }`: it renders once changes stop for that long, and at least once a second while they go on. Up to 1.8 the debounce had no such limit, so a key that changed more often than the wait never rendered. The last argument also takes a [`Schedule`](/api/types#schedule).

## `useDataSubscribeWithTransform`

Subscribes to one key and re-renders only when the transformed value changes.

```ts
const count = useDataSubscribeWithTransform(ctx, 'items', items => items?.length ?? 0)
```

## `useDataSelector`

Subscribes to the whole context and re-renders only when `selector(ctx.data)` changes. Backs `useStore(params, selector)`.

```ts
const name = useDataSelector(ctx, data => data.user?.name)
const tags = useDataSelector(ctx, data => data.tags ?? [], shallowEqual)
const name = useDataSelector(ctx, data => data.user?.name, Object.is, () => serverData) // see below
```

The optional fourth argument returns what the server rendered for this context. While hydrating, the selector runs on it when the live data has moved on, so the hydrated output matches the server HTML; `useStore` passes the store's `initialState`. The optional fifth is a [`Schedule`](/api/types#schedule): React hears about changes when it says, and the selector runs then.

## `useQuickSubscribe`

The proxy behind `useStore`. Returns an object whose property reads during render are turned into subscriptions.

```ts
const { a, b } = useQuickSubscribe(ctx) // re-renders only when a or b changes
const { a, b } = useQuickSubscribe(ctx, () => serverData)
```

The optional second argument returns what the server rendered for this context. While hydrating, reads come from it when the live data has already moved on, and React re-renders with the live data afterwards; `useStore` passes the store's `initialState`. The optional third is a [`Schedule`](/api/types#schedule).

The proxy is a new object on every render, over one subscription tracker per component, so that the React Compiler re-reads it instead of caching work keyed on its identity. Use the values read from it as dependencies, never the proxy itself.

## `scheduled`

`fn` on a [`Schedule`](/api/types#schedule), for code outside render. Calling the returned function asks for a run; the calls made before that run are one run, with the arguments of the last call. `cancel()` forgets a pending run, `flush()` makes it now.

```ts
useEffect(() => {
  const levels = new Map<number, number>()
  const publish = scheduled(() => setBook(snapshotOf(levels)), 'frame')
  const off = socket.subscribe(symbol, delta => { apply(levels, delta); publish() })
  return () => { off(); publish.cancel() }
}, [symbol])
```

Runs due at the same moment share one batch with the readers scheduled the same way, so React renders them in one commit.

## `useFrameState`

`useState` whose updates apply once per animation frame. The updates set during a frame apply in order, and the component renders once, in the frame, together with the readers scheduled `'frame'`. The setter is stable.

```ts
const [tickers, setTickers] = useFrameState<Record<string, Ticker>>({})
useEffect(() => socket.subscribe('tickers', batch => setTickers(prev => merge(prev, batch))), [])
```

In a store hook, the store publishes once per frame instead of once per message. Use `scheduled` instead when the messages go into a mutable buffer and one function turns it into state.

## `paramsToId`

Serializes a params object into the deterministic id used in store names: sorted keys, URI-encoded keys and values, joined with `&`. Keys whose value is `undefined` are left out. A string that reads like a number, bigint, boolean or `null` is quoted and a bigint ends in `n`, so values of different types never share an id. Throws for object or function values.

```ts
paramsToId({ b: 2, a: 'x y' })          // "a=x%20y&b=2"
paramsToId({ id: '2', page: undefined }) // "id='2'"
```

## `shallowEqual`

```ts
function shallowEqual(a: unknown, b: unknown): boolean
```

`Object.is` one level deep, for the `isEqual` argument of `useStore(params, selector, isEqual)` and `useDataSelector`. Two arrays, plain objects, `Map`s or `Set`s of the same kind are equal when their items, keys or values are each `Object.is`-equal. Any other pair of objects, such as dates or class instances, is equal only when it is the same object.

```ts
const ids = useVisible({ projectId }, s => s.ids, shallowEqual) // re-renders only when the ids change
```

## `formatState`

```ts
function formatState(value: unknown, indent = 2): string
```

JSON text for a state object, as used by `debugging` and the dev tool's default renderer. Unlike `JSON.stringify` it never throws and keeps what state objects commonly hold: functions as `"ƒ name()"`, `undefined`, `bigint` (`"10n"`) and symbols as text, `Map` and `Set` as their entries, Errors as `"Name: message"`, and circular references as `"[Circular]"`.

## `useArrayChangeId`

Returns a string that changes whenever any element of the array changes (`Object.is`). Used by `useDataSourceMultiple` to batch publishes.
