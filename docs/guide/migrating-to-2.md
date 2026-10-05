# Migrating to 2.0

2.0 keeps the idea and trims the API to what it needs: stores that are **lazy, shared, automatic and composable**. The whole API is three things.

```ts
import { createStore, useMultipleStore, AutoRootCtx } from 'react-state-custom'

const { useStore, storeRef } = createStore(name, useFn, { timeToClean, schedule })

useStore(params?)                               // tracking proxy
useStore(params, { select, isEqual, schedule }) // selection
storeRef(params)                                // one instance: get, subscribe, retain
useMultipleStore(refs, { select, schedule })    // several instances in one call
<AutoRootCtx />                                 // mount once
```

Schedulers move to `react-state-custom/schedulers`; the testing helpers and the dev tool stay in their own entries.

1.10 already has the new API next to the old one, and marks everything 2.0 removes `@deprecated`, so your editor strikes it through. Move to the new forms on 1.10, with the app working at every step, then upgrade. In 2.0, TypeScript rejects the old forms, and in development the ones JavaScript would accept silently (a selector function passed to `useStore`, `initialState`, a number as options) throw an error that says what to write instead.

## Selectors

The selector moves into the options, next to `isEqual` and `schedule`:

```ts
// 1.x
const name = useUser({ id }, s => s.user?.name)
const ids = useList({ id }, s => s.ids, shallowEqual)
const total = useCart(s => s.total)

// 2.0
const name = useUser({ id }, { select: s => s.user?.name })
const ids = useList({ id }, { select: s => s.ids })
const total = useCart(undefined, { select: s => s.total })
```

`isEqual` now defaults to `shallowEqual`, so a selector that returns a fresh array of the same items no longer re-renders. Pass `isEqual: Object.is` where you relied on identity.

## `getStore` → `storeRef`

The same handle under a new name, and what `useMultipleStore` takes:

```ts
const { useStore: useCart, storeRef: cartRef } = createStore('cart', useCartState)
cartRef({ userId }).get().addItem?.(item)
```

## `initialState`

Gone. Stores are lazy: a store starts when its first reader asks for it, so that reader's first render never has the data. Every key is typed as optional and reads `undefined` until the store has run once; default at the read:

```tsx
// 1.x
createStore('user', useUserState, { initialState: { user: null, isLoading: true } })
const { user, isLoading } = useUser({ id })

// 2.0
createStore('user', useUserState)
const { user, isLoading = true } = useUser({ id })
```

On the server, `useStore` returns `{}`, so the server HTML shows the same loading state as the first client render. See [Before the data arrives](/guide/getting-started#before-the-data-arrives).

## Suspense

`useStoreSuspense` is gone. Render the fallback from the store's values:

```tsx
const { user, isLoading } = useUser({ id })
if (isLoading !== false || !user) return <Spinner />
```

## Errors

`useStoreStatus`, the `Wrapper` prop and the `StoreErrorBoundary` export are gone. Each store still runs inside its own error boundary, so one store that throws never stops the others. What changes is its readers: in 1.x they kept the last values of a failed store; in 2.0 they throw its error, for their own error boundary. Put error boundaries around the parts of the screen that can fail on their own (without one, the error reaches the root and React unmounts the app). Report errors with React's `onCaughtError` root option. Expected failures belong in the store's state, with a retry action. See [Error handling](/guide/error-handling).

## Scopes

`StateScopeProvider` is gone, and with it `useCtxState`. Every store is global. When two parts of the app need separate instances of the same store, put what tells them apart in the params:

```tsx
// 1.x: one instance per scope
<StateScopeProvider><Editor documentId={id} /></StateScopeProvider>
<StateScopeProvider><Editor documentId={id} /></StateScopeProvider>

// 2.0: one instance per params
<Editor documentId={id} copy="left" />    // useDocument({ documentId, copy })
<Editor documentId={id} copy="right" />
```

To start every store afresh, as a test or an example preview does, remount `AutoRootCtx` with a new `key`.

## Store options

- `AttachedComponent`: write the effect in the store hook.
- A number as options: `{ timeToClean: 5000 }`.
- The `preState` argument of the hook: keep the instance with `timeToClean`, or [keep the values in a store of their own](/guide/store-options#keeping-the-values-not-the-resource). A hot update that changes the hooks a store calls restarts it from its own initial state, as Fast Refresh does with a component.
- The `debugging` prop of `AutoRootCtx`: use the dev tool.

## Types and tests

- `StoreState<State>` and `StoreRef<State>` take the state type only; the second parameter was the keys of `initialState`.
- `StoreSelectOptions` is gone: `StoreSelect<State, R>` types the options of a selection.
- `mockStore(store, mock)` from `react-state-custom/testing`: a mock hook receives `(params)`, no `preState`. The helpers take `useStore` or `storeRef`.

## Imports

| 1.x | 2.0 |
|---|---|
| `frame`, `throttle`, `debounce`, `idle`, `sync`, `scheduled`, `useFrameState`, `Scheduler` from `react-state-custom` | from `react-state-custom/schedulers` |
| `shallowEqual` | the default `isEqual` of `select` |
| `createRootCtx`, `createAutoCtx` | `createStore` |
| `Context`, `getContext`, `acquireContext`, `useDataContext`, `useDataSource*`, `useDataSubscribe*`, `useDataSelector`, `useQuickSubscribe`, `useArrayChangeId`, `paramsToId`, `formatState` | internal; `useStore`, `{ select }`, `useMultipleStore` and `storeRef` cover what they were used for |
| `StoreHandle` | `StoreRef` |
| `StoreStatus`, `StoreStateWith`, `StateDebugRenderer` | removed with their APIs |

## Many instances

New in 1.10 and the reason for `storeRef`: [`useMultipleStore`](/api/use-multiple-store) reads a list of instances in one call, which the rules of hooks did not allow with `useStore`.

```ts
const rooms = useMultipleStore(roomIds.map(id => roomRef({ id })))
const unread = useMultipleStore(roomIds.map(id => roomRef({ id })), {
  select: rooms => rooms.reduce((sum, room) => sum + (room.unread ?? 0), 0),
})
```
