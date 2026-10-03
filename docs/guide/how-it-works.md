# How it works

A store is a hook running inside a **headless component**.

1. `createStore(name, useFn)` registers your hook under a name.
2. The first time a component calls `useStore(params)`, `AutoRootCtx` mounts a hidden component that runs `useFn(params)`. Its return value is published, key by key, to a shared `Context` for that name and params.
3. `useStore` returns a proxy. Every key you read during render becomes a subscription, so the component re-renders only when one of those keys changes (compared with `Object.is`).
4. Components that call `useStore` with the same params share one instance. Different params get their own instance.
5. When the last consumer unmounts, the instance is torn down after `timeToClean` milliseconds (default `0`). Effects inside your hook clean up exactly as they would anywhere else.

Because the store *is* a hook, everything you already know works inside it: `useState`, `useEffect`, `useMemo`, `useReducer`, custom hooks and other stores.

## Render flow

```
<AutoRootCtx />                     <YourComponent />
   │                                     │
   │                                     │ useStore(params)       render 1: initialState or undefined
   │  ◄─── "mount name?params" ──────────┤
   │ mounts <StateRunner>                │
   │   runs useFn(params)                │
   │   publishes keys (layout effect) ──►│ re-render with data    render 2
   │                                     │
   │ store state changes                 │
   │   re-renders StateRunner            │
   │   publishes changed key ───────────►│ re-render only if that key was read
```

A consumer therefore renders twice on its way to first data, or once when `initialState` already matches what the hook publishes first. Each later update is two commits: the store component re-renders and publishes from a layout effect, then the subscribed consumers re-render in one synchronous pass through `useSyncExternalStore`.

## Identity

The identity of an instance is `name` plus the serialized params, for example `todos?listId=work`. Params are serialized with sorted keys and URI encoding, so key order does not matter and values cannot collide. Only primitives are allowed as params; see [Parameterized stores](/guide/parameterized-stores).

## Stable actions

Functions returned by the store hook are wrapped once per key, so their identity is stable across store renders while always calling the latest closure. A consumer that only reads `increment` does not re-render when `count` changes, and actions are safe in dependency arrays.

A function that a consumer **calls while rendering** is a value, not an action: a getter such as `getItem(id)`, a selector that calls one, a sort order held in state, a component. When the store returns a new implementation of it (a `useCallback` whose dependencies changed, a new value in `useState`), the consumers that called it re-render, and a component returned this way remounts. Calls from event handlers and effects never subscribe. An inline function called during render is new on every store render, so its callers re-render with every store render; memoize it with `useCallback` when that matters.

## Scopes

`AutoRootCtx` is the global scope. A `StateScopeProvider` is a separate scope with its own instances of every store, even for the same name and params. See [Scopes](/guide/scopes).

## Lower layers

`createStore` is `createAutoCtx(createRootCtx(name, useFn), options)`. `createRootCtx` builds the headless `Root` component and the `Context` plumbing; `createAutoCtx` connects it to `AutoRootCtx` for automatic mounting. These, and the `Context` pub/sub class with its subscribe hooks, are exported for building custom abstractions. See [Primitives](/api/primitives).
