# Testing helpers

Imported from a separate entry, for test code only:

```ts
import { flushScheduled, mockStore, resetStores, storeHandle, waitForStore } from 'react-state-custom/testing'
import type { StoreMock, StoreFunction, WaitForStoreOptions } from 'react-state-custom/testing'
```

Each helper takes a store by any function `createStore` returned for it (`useStore`, `getStore`, `useStoreSuspense`, `useStoreStatus`, `useCtxState`), so a module that exports only `useStore` is enough. The params and state types are read from `useStore`, `getStore` and `useStoreSuspense`. A function `createStore` did not return throws a `TypeError`. See the [Testing guide](/guide/testing) for how they fit together.

## `mockStore`

```ts
function mockStore(
  store: StoreFunction,
  mock: Partial<State> | ((params: Params, preState: Partial<State>) => Partial<State>),
): StoreMock<State>

type StoreMock<State> = {
  set(values: Partial<State>): void
  restore(): void
}
```

Replaces the store's hook in the instances that start from now on, in every scope. `mock` is what they publish: some of the store's keys or all of them, or a hook of `(params, preState)` returning them, which may use other hooks and may throw to fail the store. Functions are published as actions, with stable identities that call the function passed.

The store's own hook and its `AttachedComponent` do not run. `initialState` and `timeToClean` apply as usual. An instance already running keeps the store's hook; `mockStore` logs a warning naming it.

- `set(values)` merges `values` over what the mock returns, in every instance running it: they publish the change and their readers re-render. Wrap it in `act`.
- `restore()` stops mocking: instances started from now on run the store's hook. Running ones keep the mock until they are torn down.

## `resetStores`

```ts
function resetStores(): void
```

Removes every mock and drops every cached context with the state it holds, so the next test starts from nothing. It also forgets pending scheduled renders. Call it after each test, once the rendered trees are unmounted (after Testing Library's `cleanup`).

## `flushScheduled`

```ts
function flushScheduled(): boolean
```

Makes every pending scheduled render happen now: those of components reading with a `schedule` (`'frame'`, throttle, debounce, idle), `useFrameState` updates and [`scheduled`](/api/primitives#scheduled) functions. Wrap it in `act`. Returns whether anything was pending. What those renders publish can schedule more: a component reading a store that is fed by a frame-buffered one needs a second call. With fake timers, advancing them does the same (`vi.advanceTimersToNextFrame()` for frames).

## `storeHandle`

```ts
function storeHandle(store: StoreFunction, params?: Params): StoreHandle<State, Initial>
```

The store's [`getStore(params)`](/api/create-store#getstore-params) handle, reached from any of its functions. Global scope only, like `getStore`. See [`StoreHandle`](/api/types#storehandle).

## `waitForStore`

```ts
function waitForStore(store: StoreFunction, params?: Params): Promise<StoreState<State, Initial>>
function waitForStore(
  store: StoreFunction,
  params: Params | undefined,
  isReady: ((state: StoreState<State, Initial>) => boolean) | undefined,
  options?: WaitForStoreOptions,
): Promise<StoreState<State, Initial>>
function waitForStore<K extends readonly (keyof State)[]>(
  store: StoreFunction,
  params: Params | undefined,
  keys: K,
  options?: WaitForStoreOptions,
): Promise<StoreStateWith<State, Initial, K[number]>>

type WaitForStoreOptions = {
  timeout?: number   // milliseconds, default 1000
}
```

Resolves with the state once the instance for `params` has published (its hook ran), or once `isReady(state)` returns true, or once each of `keys` holds a value (not `undefined`; `null` counts). With keys written in the call, the result types them as present, as [`useStoreSuspense(params, keys)`](/api/types#storestatewith) does. `params` may be `undefined` when the store has no required params.

- Resolves at once when the condition already holds. The readers of the store have re-rendered by then.
- Rejects with what the store hook threw when the store fails, before or while waiting.
- Rejects after `timeout` with an `Error` that says why: no instance is running, the store has not published yet, which keys are still `undefined`, or that `isReady` still returns false.
- Holds the store's context while waiting but does not start the store: render a component that reads it, or `retain()` it.
- Turns React's act environment off while waiting (`globalThis.IS_REACT_ACT_ENVIRONMENT`), as Testing Library's `waitFor` does, and restores it once the last wait ends.
- Global scope only, like `getStore`.
