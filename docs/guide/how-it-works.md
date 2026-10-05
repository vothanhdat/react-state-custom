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
   │                                     │ useStore(params)       render 1: every key undefined
   │  ◄─── "mount name?params" ──────────┤
   │ mounts <Store(name)>                │
   │   runs useFn(params)                │
   │   publishes keys (layout effect) ──►│ re-render with data    render 2
   │                                     │
   │ store state changes                 │
   │   re-renders Store(name)            │
   │   publishes changed key ───────────►│ re-render only if that key was read
```

A consumer therefore renders twice on its way to first data. Each later update is two commits: the store component re-renders and publishes from a layout effect, then the subscribed consumers re-render in one synchronous pass through `useSyncExternalStore`.

## Identity

The identity of an instance is `name` plus the serialized params, for example `todos?listId=work`. Params are serialized with sorted keys and URI encoding, so key order does not matter and values cannot collide. Only primitives are allowed as params; see [Parameterized stores](/guide/parameterized-stores).

## Stable actions

Functions returned by the store hook are wrapped once per key, so their identity is stable across store renders while always calling the latest closure. A consumer that only reads `increment` does not re-render when `count` changes, and an effect that lists an action runs again only when it first appears and when the instance restarts: each instance has its own actions, and those of a torn-down instance do nothing. See [Before the data arrives](/guide/getting-started#before-the-data-arrives) for which effects should list them.

A function that a consumer **calls while rendering** is a value, not an action: a getter such as `getItem(id)`, a selector that calls one, a sort order held in state, a component. When the store returns a new implementation of it (a `useCallback` whose dependencies changed, a new value in `useState`), the consumers that called it re-render, and a component returned this way remounts. Calls from event handlers and effects never subscribe. An inline function called during render is new on every store render, so its callers re-render with every store render; memoize it with `useCallback` when that matters.

## Stores as services

Think of each store as a small service:

- **It owns one part of the app**: its data, the IO that fills it (fetches, sockets, timers) and its lifetime. Nothing else writes its state; other code calls its actions.
- **Readers subscribe** to the keys they need. The store starts when the first reader arrives and stops `timeToClean` after the last one leaves.
- **Its returned type is its contract.** Every key is optional until the hook has run, and data from IO stays `undefined` until it arrives. See [Before the data arrives](/guide/getting-started#before-the-data-arrives).
- **A store that reads other stores** is a reader like any component: it combines what they publish into what its own readers need, such as a filtered list or a count.

Split stores along those lines: a new store for a new owner, new IO or a different lifetime, not one per derived value. A value one component derives is a [selector](/guide/selectors); a value many components read is a store that computes it once ([Composing stores](/guide/composing-stores)). Each store in a chain adds a commit to every update and one more step for values to travel.

### Data across stores

Values travel one store at a time: a store publishes one commit after the stores it reads. For that one render, a component that reads two stores can see the new value of one next to the old value of the other. Nothing is painted in between, but render logic and effects run on it. Write readers that tolerate it:

- **Check before you read.** A lookup by id can find nothing: the item was just deleted, or the list that gave you the id has not caught up. Return early, or read with `?.` and `??`. Turn on TypeScript's [`noUncheckedIndexedAccess`](https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess) so that `tasks[id]` is typed `Task | undefined` and the compiler asks for the check, or type the record as `Record<string, Task | undefined>`.
- **Join by id, not by position.** An index from one store used on an array from another can point at a different item, and no check catches that.
- **Decide in one place.** An effect that acts on values from several stores (a request, a save, analytics, scrolling) runs on that render too. Compute the decision from one store, or move it into a store that reads the others.
- **Don't assert that two stores agree.** A check such as `stats.done === doneTasks.length` fails for that render.

Reading everything a component needs from one store avoids the question: values published by the same store always arrive together.

## Many instances

`useStore` reads one instance, and the rules of hooks keep its calls fixed in number. [`useMultipleStore(refs)`](/api/use-multiple-store) reads a list of instances in one call, refs made by `storeRef(params)`, so a component or a store can follow one instance per item of a list whose length changes. Each instance starts, is shared and stops as with `useStore`.

