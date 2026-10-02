# React State Custom - AI Context

**Target Audience:** AI Assistants (Gemini, ChatGPT, Claude, Copilot)
**Goal:** Generate idiomatic, high-performance code using `react-state-custom`.

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
-   **Destructure immediately**: `const { data } = useStore(...)`. The returned object is a proxy that tracks usage during render.
-   **No Providers**: Never manually wrap components in providers. `AutoRootCtx` handles everything.
-   **Keep it simple**: Don't use `createRootCtx` or `createAutoCtx` directly. `createStore` is the only API you usually need.
-   **First render**: store values are `undefined` until the store hook has run once. Pass `createStore(name, useFn, { initialState: {...} })` to avoid that and to get non-optional types for those keys.
-   **No params**: a store whose hook takes no required params can be consumed as `useStore()`.
-   **SSR / Next.js**: client-side library, SSR-safe. Server output shows `initialState`; stores run after hydration. In the App Router put `AutoRootCtx` and every `useStore` caller in a `'use client'` module.
-   **Dev tool** lives in a separate entry: `import { DevToolContainer } from 'react-state-custom/dev-tool'` plus `import 'react-state-custom/style.css'`.
-   **Isolated subtrees**: wrap a subtree in `<StateScopeProvider>` to give it its own store instances (same definitions, separate state). It is its own root; no extra `AutoRootCtx` inside.
-   **Errors**: a store hook that throws is caught by `StoreErrorBoundary` (default `Wrapper` of `AutoRootCtx`); other stores keep running. Pass `Wrapper` to `AutoRootCtx` to report or render errors.
-   **Reads outside render**: the `useStore` proxy only tracks reads during render. Destructure at the top of the component; do not keep the proxy for later.
-   **Stores inside stores**: a store hook may call another store's `useStore()`. Avoid cycles (A reads B, B reads A); they are reported with a dev warning.
-   **Deep or derived reads**: `useStore(params, s => s.user?.name)` re-renders only when the selected value changes. Prefer it over reading a big object and re-rendering on every change inside it.
-   **Suspense**: `useStoreSuspense(params, s => !s.isLoading)` instead of `if (isLoading) return <Spinner />`. Client only.
-   **Outside React**: `getStore(params).get()` for a snapshot, `.subscribe(listener)` for changes, `.retain()` to keep a store running with no component. Use it in socket handlers, routers and tests, and in event handlers that need the latest value.

## 🛠️ Common Patterns

### Async Data (Data Fetching)

```typescript
const useUserState = ({ userId }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setData);
  }, [userId]);

  return { data, isLoading: !data };
};
```

### Derived State

Since stores are just hooks, you can use `useMemo` for derived data.

```typescript
const useCartState = () => {
  const [items, setItems] = useState([]);

  const total = useMemo(() =>
    items.reduce((sum, item) => sum + item.price, 0)
  , [items]);

  return { items, total };
};
```
