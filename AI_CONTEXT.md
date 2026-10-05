# React State Custom - AI Context

**Target Audience:** AI Assistants (Gemini, ChatGPT, Claude, Copilot)
**Goal:** Generate idiomatic, high-performance code using `react-state-custom`.
**Full documentation:** https://vothanhdat.github.io/react-state-custom/docs/ (guide, API reference, testing, limitations).

---

## 🧠 Mental Model: "It's Just a Hook"

`react-state-custom` turns standard React hooks into shared global stores.

1.  **Define Logic**: Write a hook (`useState`, `useEffect`, `useMemo`).
2.  **Share Logic**: Wrap it with `createStore`.
3.  **Consume Logic**: Use the generated hook in any component.

**Key Difference:** Unlike Redux or Zustand, there is no external store object. The "store" is literally a React component running your hook in the background, managed by `AutoRootCtx`.

---

## 🏆 The Golden Path

**Always** follow this pattern unless explicitly asked for low-level primitives.

### 1. The Store (Features/State)

```typescript
// features/counterState.ts
import { useState } from 'react';
import { createStore } from 'react-state-custom';

// 1. Define the hook (Standard React)
const useCounterState = ({ initial = 0 }: { initial?: number }) => {
  const [count, setCount] = useState(initial);
  const increment = () => setCount(c => c + 1);
  return { count, increment };
};

// 2. Export the store (One line)
export const { useStore: useCounterStore } = createStore('counter', useCounterState);
```

### 2. The Root (App Entry)

```tsx
// App.tsx
import { AutoRootCtx } from 'react-state-custom';

export default function App() {
  return (
    <>
      <AutoRootCtx /> {/* 👈 Must be at the top */}
      <MainContent />
    </>
  );
}
```

### 3. The Consumer (Components)

```tsx
// components/Counter.tsx
import { useCounterStore } from '../features/counterState';

export function Counter() {
  // 3. Use the hook
  // ⚡️ Automatic subscription: re-renders ONLY when 'count' changes.
  const { count, increment } = useCounterStore({ initial: 10 });
  
  return <button onClick={increment}>{count}</button>;
}
```

---

## ✅ Best Practices

-   **Params must be primitives**: Store parameters (`{ id: '123' }`) are serialized to create unique store instances. Avoid passing objects or callbacks as params.
-   **Destructure immediately**: `const { data } = useStore(...)`. The returned object is a proxy that tracks usage during render. It is a new object every render (React Compiler safe); never use it as a dependency.
-   **No Providers**: Never manually wrap components in providers. `AutoRootCtx` handles everything.
-   **Keep it simple**: Don't use `createRootCtx` or `createAutoCtx` directly. `createStore` is the only API you usually need.
-   **First render**: stores are lazy, so values are `undefined` until the store hook has run once. Read with `??` / `?.`, call actions with `?.()` from event handlers, or pass `createStore(name, useFn, { initialState: {...} })` when you want non-optional types for those keys, values in server HTML, or a single render on mount. Never call an action during render; start loading inside the store. An effect that only calls an action lists it as a dependency and returns early while it is `undefined`; an effect that does other work (a socket, a fetch) keeps actions out of its dependencies, or it redoes that work when they arrive: read them through `useEffectEvent` or a ref, or have the store emit an event (`onFill(listener)`) that a store in the UI layer subscribes to.
-   **Data across stores**: a store publishes one commit after the stores it reads, so values from two stores can disagree for one render. Check before reading (`if (!task) return null`; `noUncheckedIndexedAccess` makes `tasks[id]` `Task | undefined`), join by id rather than by index, and make decisions or effects that need several stores in one store.
-   **Collections**: keep independently changing items as an object keyed by id (`return { ...byId, setItem }`), not an array under one key, so a reader of one item re-renders only for that item. An item with its own lifecycle (fetch, subscription) is a parameterized store: `useItem({ id })`, or one collection store with a `subscribe(id)` action that counts readers. Rows take an id, read their item with a selector, are wrapped in `memo`, and return `null` when the item is missing; the list reads its ids with `shallowEqual`.
-   **Many instances in one store**: never call a store hook in a loop. One store returns an object keyed by id; the store above calls that hook once and reads the keys it needs.
-   **No params**: a store whose hook takes no required params can be consumed as `useStore()`, and with a selector as `useStore(s => s.total)` (selector first). Read options go after the params: `useStore(undefined, { schedule: frame() })`; `useStore({ schedule })` would read the object as params.
-   **SSR / Next.js**: client-side library, SSR-safe. Server output shows `initialState`; stores run after hydration. In the App Router put `AutoRootCtx` and every `useStore` caller in a `'use client'` module.
-   **Dev tool** lives in a separate entry: `import { DevToolContainer } from 'react-state-custom/dev-tool'` plus `import 'react-state-custom/style.css'`. For an expandable tree, `ObjectDataView` from `react-state-custom/dev-tool/obj-view` (needs the optional peer `react-obj-view`). In tests, `<AutoRootCtx debugging />` renders each store's state as `<pre data-store="name?params">`.
-   **Isolated subtrees**: wrap a subtree in `<StateScopeProvider>` to give it its own store instances (same definitions, separate state). It is its own root; no extra `AutoRootCtx` inside.
-   **Errors**: a store hook that throws is caught by `StoreErrorBoundary` (default `Wrapper` of `AutoRootCtx`); other stores keep running. Pass `Wrapper` to `AutoRootCtx` to report or render errors. `useStore` keeps the last values of a failed store, so read `const { failed, error } = useStoreStatus(params)` to render the failure. Catch expected failures (a request) in the hook and publish them as state.
-   **Reads outside render**: the `useStore` proxy only tracks reads during render. Destructure at the top of the component; do not keep the proxy for later.
-   **Stores inside stores**: a store hook may call another store's `useStore()`. Avoid cycles (A reads B, B reads A); they are reported with a dev warning.
-   **Update cadence**: for data that changes faster than anyone reads it (prices, sensors, logs), let a reader choose how often it renders with a scheduler imported from the package: `useStore(params, { schedule: frame() })`, `useStore(params, selector, { isEqual, schedule: throttle(100) })`, also `debounce(ms, { maxWait })`, `idle(ms)` and `sync()` (the default, to override a store's); `createStore(name, fn, { schedule })` sets the default for every reader. The factories return the same object for the same arguments, so call them inline; only the imported ones are bundled. Only that reader waits: the store, `getStore().get()` and actions are immediate, the first data is never delayed, the render reads the latest data. Schedule leaf views (charts, tables, logs), not readers that decide. In a store fed by a socket, publish once per frame with `useFrameState(initial)` (a `useState` applied once per frame) or `const publish = scheduled(() => setX(snapshot()), frame())` called per message (`publish.cancel()` in the cleanup). Tests run pending scheduled renders with `act(() => { flushScheduled() })` from `react-state-custom/testing`.
-   **Layers**: in a larger app keep `domain` (pure functions) → `stores/core` (IO and data; commands return `{ ok, error }`, never show toasts) → `stores/ui` (view-models; a store only when it holds state or several components read it, otherwise a plain hook) → components (read `stores/ui` only). Check the import direction with a test.
-   **Events**: something that happens once (a fill, a message) goes out through a listener API on the store (`onFill(listener)` returning the unsubscribe; call listeners after the store accepted the message, each in try/catch). The listener that turns it into a toast is a store in the UI layer, started once near the root, not a plain hook (two components would show two toasts).
-   **Deep or derived reads**: `useStore(params, s => s.user?.name)` re-renders only when the selected value changes. Prefer it over reading a big object and re-rendering on every change inside it. When many components read different fields of one nested object, return the fields as top-level keys instead; for a nested object you do not shape (a socket payload, a query result), flatten it once in a store above: `const { player } = usePlayerStore({ id }); return { ...player }`.
-   **Suspense**: `useStoreSuspense(params, s => !s.isLoading)` instead of `if (isLoading) return <Spinner />`. Client only. To render from `initialState` without a fallback, list the keys the component reads: `useStoreSuspense(params, ['items', 'add'])` waits for each to hold a value and types only those as present. Write the list in the call or keep it `as const`; a widened `(keyof State)[]` is typed like `useStore`.
-   **Outside React**: `getStore(params).get()` for a snapshot, `.subscribe(listener)` for changes, `.retain()` to keep a store running with no component. Use it in socket handlers, routers and tests, and in event handlers that need the latest value.
-   **`timeToClean: Infinity`** keeps a store until `AutoRootCtx` unmounts (an app-wide session or connection).
-   **Tests**: helpers live in `react-state-custom/testing`. Call `resetStores()` after each test (after `cleanup()`). `mockStore(useX, { ...someKeys })` (or a hook `(params) => values`) replaces a store's hook for instances started afterwards, so call it before rendering; `act(() => mock.set({...}))` changes what it publishes. `storeHandle(useX, params)` is the `getStore` handle from any store function. `await waitForStore(useX, params, ['key'])` waits until the keys hold values and types them as present. Keep a reference to each `vi.fn()` you pass as an action and assert on it.
-   **What to share**: callers with the same params share everything the hook holds. Keep per-view state (cursor, selection, an open panel) in the component, or in a store with its own identity (`{ documentId, viewId }`).
-   **Lifecycle**: `timeToClean` keeps the instance running, effects included (polls keep polling). To keep only the values after a screen closes, put them in a store without effects and a long `timeToClean`, and run the socket or poll in another store that writes into it. A task that must outlive its screen (an upload) retains its own store while it runs: `useEffect(() => { if (status === 'uploading') return getUpload({ id }).retain() }, [status, id])`. `preState` does not survive a navigation.

## 🛠️ Common Patterns

### Async Data (Data Fetching)

```typescript
const useUserState = ({ userId }: { userId: string }) => {
  const [data, setData] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUser(userId).then(u => { if (!cancelled) setData(u); });
    return () => { cancelled = true; };
  }, [userId]);

  return { data, isLoading: !data };
};

export const { useStore: useUserStore } = createStore('user', useUserState, {
  initialState: { data: null, isLoading: true },
});
```

### Derived State

Since stores are just hooks, you can use `useMemo` for derived data.

```typescript
const useCartState = () => {
  const [items, setItems] = useState<Item[]>([]);

  const total = useMemo(() =>
    items.reduce((sum, item) => sum + item.price, 0)
  , [items]);

  return { items, total };
};

export const { useStore: useCartStore } = createStore('cart', useCartState);
```
