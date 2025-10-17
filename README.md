# react-state-custom

Simple, powerful shared state for React 19.
Zero boilerplate. Precise re-renders. Fully typed.

- Install: npm i react-state-custom
- Add one provider: <AutoRootCtx />
- Create a state hook and register it
- Subscribe to exactly what you need

## Install

```bash
npm install react-state-custom
# peer deps: react 19, react-dom 19
```

## 60‑second setup

1) Add the root provider once

```tsx
// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AutoRootCtx } from 'react-state-custom';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AutoRootCtx />
    <App />
  </React.StrictMode>
);
```

2) Define state and register it

```tsx
// counterState.ts
import { useState } from 'react';
import { createRootCtx, createAutoCtx } from 'react-state-custom';

function useCounterState() {
  const [count, setCount] = useState(0);
  const inc = () => setCount(c => c + 1);
  const dec = () => setCount(c => c - 1);
  return { count, inc, dec };
}

// Create a context for this state hook
export const { useCtxState: useCounterCtxState } = createAutoCtx(
  createRootCtx('counter', useCounterState)
);
```

3) Consume it (simple)

```tsx
// Counter.tsx
import { useQuickSubscribe } from 'react-state-custom';
import { useCounterCtxState } from './counterState';

export function Counter() {
  const ctx = useCounterCtxState();
  const { count, inc, dec } = useQuickSubscribe(ctx);

  return (
    <div>
      <button onClick={dec}>-</button>
      <span>{count}</span>
      <button onClick={inc}>+</button>
    </div>
  );
}
}
```

4) Or subscribe only to specific keys (maximum performance)

```tsx
import { useDataSubscribeMultiple } from 'react-state-custom';
import { useCounterCtxState } from './counterState';

export function CountBadge() {
  const ctx = useCounterCtxState();
  const { count } = useDataSubscribeMultiple(ctx, 'count');
  return <span>{count}</span>;
}
```

## Why it’s simple

- One provider (<AutoRootCtx />), no boilerplate
- Any state shape—just return an object from your hook
- useQuickSubscribe for easy full-state access

## Why it’s strong

- Render-precise: components only update when subscribed keys change
- Type-safe: full TypeScript support with inferred keys and shapes
- Flexible: works with any data source or async logic
- Composable: create multiple contexts and combine freely
- Production-friendly: minimal ceremony, clear patterns

## Common use cases

- Global state without Redux complexity
- Cross-component communication
- Parametrized state (e.g., userId, filters)
- Optimized read patterns (subscribe to specific keys)

## Core API in 20 seconds

- createRootCtx(name, useStateHook): registers a typed context from your hook
- createAutoCtx(rootCtx): auto-manages context lifecycle
- AutoRootCtx: mount once near the app root
- useQuickSubscribe(ctx): select the whole state object
- useDataSubscribeMultiple(ctx, ...keys): subscribe to specific keys

## Full API docs

See API_DOCUMENTATION.md for details and patterns.

## Requirements

- React 19, react-dom 19

## License

MIT