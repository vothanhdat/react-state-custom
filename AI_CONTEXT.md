# React State Custom - AI Context & Best Practices

This document is designed to help AI assistants (Gemini, ChatGPT, Claude, Copilot) understand the preferred patterns and API usage for `react-state-custom`.

## 🧠 Mental Model

`react-state-custom` is a **hook-first** state management library.
- **State is just a hook**: You define state logic using standard React hooks (`useState`, `useEffect`, `useMemo`).
- **Stores are headless components**: The library runs your hook in a hidden component (`Root`) and publishes the results to an event-driven context.
- **Consumption is selective**: Components subscribe only to the specific fields they need, preventing unnecessary re-renders.

## 🏆 The "Golden Path" (Preferred API)

Always prefer `createStore` over the lower-level `createRootCtx` / `createAutoCtx` primitives unless specifically requested.

### 1. Define State (The Hook)
Write a standard React hook. It receives `params` (props) and `preState` (warm-start data).

```typescript
// state.ts
import { useState } from 'react';

export const useCounterState = ({ initial = 0 }: { initial?: number }) => {
  const [count, setCount] = useState(initial);
  const increment = () => setCount(c => c + 1);
  return { count, increment };
};
```

### 2. Create Store (The Factory)
Use `createStore` to generate the store hooks.

```typescript
// state.ts
import { createStore } from 'react-state-custom';

export const { useStore: useCounterStore } = createStore('counter', useCounterState);
```

### 3. Mount Context (The Root)
Mount `<AutoRootCtx />` **once** near the top of the app.

```tsx
// App.tsx
import { AutoRootCtx } from 'react-state-custom';

export default function App() {
  return (
    <>
      <AutoRootCtx />
      <MainContent />
    </>
  );
}
```

### 4. Consume State (The Component)
Use the generated `useStore` hook. It returns a proxy that tracks usage.

```tsx
// Counter.tsx
import { useCounterStore } from './state';

export function Counter() {
  // ⚡️ Only re-renders when 'count' changes
  const { count, increment } = useCounterStore({ initial: 10 });
  
  return <button onClick={increment}>{count}</button>;
}
```

---

## ✅ Do's and ❌ Don'ts

### ✅ DO
- **DO** use `createStore` for 95% of use cases.
- **DO** use `AutoRootCtx` to manage store lifecycles automatically.
- **DO** keep store parameters simple (primitives like strings/numbers) to ensure stable context IDs.
- **DO** destructure `useStore` results immediately during render (e.g., `const { data } = useStore(...)`).
- **DO** use `preState` in your hook if you need to persist state across hot-reloads or auto-remounts.

### ❌ DON'T
- **DON'T** use `createRootCtx` and `createAutoCtx` manually unless you are building a custom abstraction.
- **DON'T** pass objects or arrays as store parameters (e.g., `useStore({ user: { id: 1 } })`). Pass IDs instead (`useStore({ userId: 1 })`).
- **DON'T** store the proxy returned by `useStore` in a `useRef` or `useEffect`. It is designed for render-phase tracking only.
- **DON'T** manually create `Context` objects via `new Context()` unless you are building a low-level primitive.

## 🛠 API Signatures (Simplified)

```typescript
// The main factory function
function createStore<Params, State>(
  name: string, 
  useFn: (params: Params, preState: Partial<State>) => State,
  timeToClean?: number // Optional: keep-alive time in ms
): {
  useStore: (params: Params) => State; // Returns a reactive proxy
  useCtxState: (params: Params) => Context<State>; // Returns the raw context
}

// The global manager
function AutoRootCtx(props: { 
  Wrapper?: React.ComponentType; // e.g. ErrorBoundary
  debugging?: boolean; 
}): JSX.Element;
```
