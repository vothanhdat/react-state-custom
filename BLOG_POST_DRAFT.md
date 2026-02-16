# React State Management: It's Just a Hook

Managing global state in React has historically been... complicated.

Redux asks you to write reducers, actions, and selectors. Context requires manual Providers and careful optimization to avoid re-renders. Zustand and others simplify things, but still force you to learn a new API for defining your store.

What if your global state could just be... a hook?

Introducing **React State Custom**.

## The "It's Just a Hook" Philosophy

The core idea is simple: **If you know how to write a custom React hook, you already know how to write a global store.**

There are no new concepts to learn. No `set` functions injected into callbacks. No proxies to configure. Just standard React hooks.

### 1. Write Your Logic (It's just a hook)

You start by writing a standard custom hook. Use `useState`, `useEffect`, `useMemo`—whatever you need.

```tsx
// hooks/useCounter.ts
import { useState } from 'react';

export const useCounterLogic = ({ initial = 0 }) => {
  const [count, setCount] = useState(initial);
  const increment = () => setCount(c => c + 1);

  return { count, increment };
};
```

### 2. Make it Global (One line)

Wrap your hook with `createStore`. This returns a `useStore` hook that components can use to access the shared state.

```tsx
// stores/counterStore.ts
import { createStore } from 'react-state-custom';
import { useCounterLogic } from '../hooks/useCounter';

export const { useStore } = createStore('counter', useCounterLogic);
```

### 3. Use it Anywhere

Consume the state in any component.

```tsx
// components/Counter.tsx
import { useStore } from '../stores/counterStore';

export function Counter() {
  // This component will ONLY re-render when 'count' changes
  const { count, increment } = useStore({ initial: 10 });

  return <button onClick={increment}>Count: {count}</button>;
}
```

Wait, where's the `<Provider>`?

## The Magic: AutoRootCtx

React State Custom eliminates the "Provider Hell" by using a single, smart component at the root of your app: `<AutoRootCtx />`.

```tsx
// App.tsx
import { AutoRootCtx } from 'react-state-custom';

export default function App() {
  return (
    <>
      <AutoRootCtx /> {/* 👈 Handles all your stores automatically */}
      <YourAppContent />
    </>
  );
}
```

This component acts as a dynamic host for all your active stores. When a component requests a store that doesn't exist, `AutoRootCtx` spins it up. When the last subscriber unmounts, it cleans it up.

## Why You'll Love It

### 💎 Zero Boilerplate
Stop writing actions, types, and reducers. Just write hooks.

### 🚀 Automatic Lifecycle Management
Stores are created on demand and destroyed when not in use. No more memory leaks from stale stores.

### ⚡ Selective Re-renders
The `useStore` hook returns a proxy that tracks exactly which properties your component uses. If you only use `increment`, your component won't re-render when `count` changes.

### 🛡️ TypeScript Native
Because it's just a hook, TypeScript inference works perfectly out of the box. No complex type definitions required.

## Get Started

Install it today and simplify your state management.

```bash
npm install react-state-custom
```

Check out the [Live Demo](https://vothanhdat.github.io/react-state-custom/) or read the full [Documentation](./README.md).
