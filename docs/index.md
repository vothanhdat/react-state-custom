---
layout: home

hero:
  name: react-state-custom
  text: The "it's just a hook" state manager
  tagline: Turn any React hook into a shared store. No boilerplate, automatic lifecycle, selective re-renders.
  image:
    src: /logo.svg
    alt: react-state-custom
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /api/create-store
    - theme: alt
      text: Live demo
      link: https://vothanhdat.github.io/react-state-custom/

features:
  - icon: 🪝
    title: Zero boilerplate
    details: Write a hook with useState, useEffect and useMemo. Pass it to createStore. That is the whole store.
  - icon: 🎯
    title: Selective re-renders
    details: Consumers re-render only when a key they read during render changes. Selectors cover deep and derived values.
  - icon: 🔄
    title: Automatic lifecycle
    details: A store mounts when the first consumer appears and is torn down after the last one leaves. Effects clean up as usual.
  - icon: 🛡️
    title: TypeScript first
    details: Params and state are inferred from your hook. Keys seeded by initialState are typed as always present.
  - icon: 🧩
    title: Composable
    details: Stores can read other stores, take params, run in isolated scopes and be reached from outside React.
  - icon: ⚡
    title: Modern React
    details: Built on useSyncExternalStore, SSR-safe, tested under StrictMode and the React Compiler.
---

## Thirty seconds

```tsx
import { useState } from 'react'
import { createStore, AutoRootCtx } from 'react-state-custom'

// 1. A standard hook is the store logic
const useCountState = ({ initial = 0 }: { initial?: number }) => {
  const [count, setCount] = useState(initial)
  const increment = () => setCount(c => c + 1)
  return { count, increment }
}

// 2. Register it under a name
export const { useStore } = createStore('counter', useCountState, {
  initialState: { count: 0 },
})

// 3. Mount AutoRootCtx once, then read the store anywhere
function App() {
  return (
    <>
      <AutoRootCtx />
      <Counter />
    </>
  )
}

function Counter() {
  const { count, increment } = useStore({ initial: 10 })
  return <button onClick={increment}>{count}</button>
}
```

```bash
npm install react-state-custom
```
