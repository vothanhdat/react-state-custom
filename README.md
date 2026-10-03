# React State Custom

**The "It's Just a Hook" State Manager for React.**

Turn any React hook into a shared store. Zero boilerplate. Full type safety. Automatic lifecycle management.

[![Docs](https://img.shields.io/badge/Docs-Website-2563eb?style=flat-square)](https://vothanhdat.github.io/react-state-custom/docs/)
[![Demo](https://img.shields.io/badge/Demo-Live-blue?style=flat-square)](https://vothanhdat.github.io/react-state-custom/)
[![npm version](https://img.shields.io/npm/v/react-state-custom?style=flat-square)](https://www.npmjs.com/package/react-state-custom)
[![React 18+](https://img.shields.io/badge/React-18%2B-61dafb?style=flat-square)](#requirements)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

```bash
npm install react-state-custom
```

📚 **[Documentation →](https://vothanhdat.github.io/react-state-custom/docs/)** · 🎮 **[Live Demo →](https://vothanhdat.github.io/react-state-custom/)**

---

## ⚡ The 30-Second Pitch

Stop writing reducers, actions, and manual providers. If you can write a React hook, you've already written your store.

```tsx
import { useState } from 'react'
import { createStore, AutoRootCtx } from 'react-state-custom'

// 1. Write a standard hook (your store logic)
const useCountState = ({ initial = 0 }: { initial?: number }) => {
  const [count, setCount] = useState(initial)
  const increment = () => setCount(c => c + 1)
  return { count, increment }
}

// 2. Create a store
export const { useStore } = createStore('counter', useCountState, {
  initialState: { count: 0 },
})

// 3. Mount AutoRootCtx once, then use the store anywhere
function App() {
  return (
    <>
      <AutoRootCtx /> {/* 👈 runs your store hooks for you */}
      <Counter />
    </>
  )
}

function Counter() {
  const { count, increment } = useStore({ initial: 10 })
  return <button onClick={increment}>{count}</button>
}
```

**That's it.** No `Provider` wrapping per store. No complex setup. Just hooks.

---

## 🔍 How It Works

A store is a hook running inside a **headless component**.

- `createStore(name, useFn)` registers your hook under a name.
- The first time a component calls `useStore(params)`, `AutoRootCtx` mounts a hidden component that runs `useFn(params)`. Its return value is published, key by key, to a shared context.
- `useStore` returns a proxy. Every key you read during render becomes a subscription, so the component re-renders only when one of those keys changes (`Object.is`).
- Components that call `useStore` with the same `params` share one instance. Different `params` get their own instance.
- When the last consumer unmounts, the instance is torn down after `timeToClean` milliseconds (default `0`). Effects inside your hook clean up exactly as they would anywhere else.

Because the store *is* a hook, everything you already know works inside it: `useState`, `useEffect`, `useMemo`, `useReducer`, other custom hooks, and other stores.

---

## 🛠️ Quick Start

```ts
// 1. Define your state as a hook
export const useUserState = ({ userId }: { userId: string }) => {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => { fetchUser(userId).then(setUser) }, [userId])
  return { user, isLoading: !user }
}

// 2. Create the store (initialState: what consumers see before the hook runs)
export const { useStore: useUserStore } = createStore('user', useUserState, {
  initialState: { user: null, isLoading: true },
})
```

```tsx
// 3. Mount the root once
<AutoRootCtx />

// 4. Read it anywhere; two components with the same params share one instance and one fetch
function UserName({ userId }: { userId: string }) {
  const { user } = useUserStore({ userId })
  if (!user) return <Spinner />
  return <span>{user.name}</span>
}
```

## 📚 Guide

The full guide lives on the **[documentation site](https://vothanhdat.github.io/react-state-custom/docs/)**:

- [Store options](https://vothanhdat.github.io/react-state-custom/docs/guide/store-options): `initialState`, `timeToClean`, `AttachedComponent`
- [Parameterized stores](https://vothanhdat.github.io/react-state-custom/docs/guide/parameterized-stores) and [composing stores](https://vothanhdat.github.io/react-state-custom/docs/guide/composing-stores)
- [Scopes](https://vothanhdat.github.io/react-state-custom/docs/guide/scopes) with `StateScopeProvider`, [error handling](https://vothanhdat.github.io/react-state-custom/docs/guide/error-handling)
- [Selectors](https://vothanhdat.github.io/react-state-custom/docs/guide/selectors), [Suspense](https://vothanhdat.github.io/react-state-custom/docs/guide/suspense), [outside React](https://vothanhdat.github.io/react-state-custom/docs/guide/outside-react) with `getStore()`
- [Developer tools](https://vothanhdat.github.io/react-state-custom/docs/guide/devtools), [server-side rendering](https://vothanhdat.github.io/react-state-custom/docs/guide/ssr), [React Compiler](https://vothanhdat.github.io/react-state-custom/docs/guide/react-compiler), [testing](https://vothanhdat.github.io/react-state-custom/docs/guide/testing)
- [Limitations and FAQ](https://vothanhdat.github.io/react-state-custom/docs/guide/limitations)
- [API reference](https://vothanhdat.github.io/react-state-custom/docs/api/create-store): every export, including the low-level primitives

---

## 🆚 Comparison

| Feature | React State Custom | Redux | Context API | Zustand | Jotai |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Paradigm** | Just Hooks 🪝 | Actions/Reducers | Providers | Store Object | Atoms |
| **Boilerplate** | 🟢 None | 🔴 High | 🟡 Medium | 🟢 Low | 🟢 Low |
| **Auto Lifecycle** | ✅ Yes | ❌ No | ❌ No | ❌ No | ⚠️ Per atom |
| **Selective Renders** | ✅ Automatic | ⚠️ Selectors | ❌ Manual | ✅ Selectors | ✅ Per atom |
| **Learning Curve** | 🟢 Low | 🔴 High | 🟡 Medium | 🟢 Low | 🟡 Medium |

## 📊 Benchmarks

Measured with `yarn bench` (vitest + jsdom, React 19.2, no StrictMode; 1000 consumers, means in ms). Full method, render and derive counts, lines of code and caveats in [bench/README.md](./bench/README.md).

| scenario | react-state-custom | zustand | jotai | React context |
|---|---|---|---|---|
| consumer renders per update (1 key of 10 changed) | 100 | 100 | 100 | 1000 |
| update 1 key, 100 of 1000 consumers affected | 0.72 | 0.50 | 0.38 | 1.49 |
| derived sum changes, 1000 consumers (derive calls) | 4.49 (1) | 4.28 (4000) | 2.04 (1) | 3.14 (1000) |
| derived sum unchanged, none affected | 0.044 | 0.56 | 0.002 | 2.73 |
| root key changed that no derived store reads (derive calls) | 0.018 (0) | 0.019 (1000) | 0.014 (10) | 1.55 (0) |
| shop graph, one item qty changed, 235 of 1000 affected (derive calls) | 1.73 (3) | 0.71 (111) | 0.63 (3) | 1.59 (111) |
| mount + unmount 1000 consumers | 18.5 | 8.7 | 9.2 | 8.7 |

Re-render selectivity matches Zustand and Jotai. A plain update costs about twice as much because a store is a hook in a headless component: the store renders and publishes first, then its consumers render. Derived values are computed once per update, where Zustand recomputes a selector in every consumer, and a store re-runs only when a key it actually read changes. Each derived layer costs one more commit, so deep graphs widen the gap. All of it stays well under a frame at these sizes.

---

## 📋 Requirements

- React 18 or newer (`react` and `react-dom` are peer dependencies).
- Ships ESM and CommonJS builds with TypeScript declarations.
- SSR-safe: consumers render `initialState` on the server, stores run after hydration. In the Next.js App Router, `AutoRootCtx` and every `useStore` caller live in a `'use client'` module.
- Works with the React Compiler; covered by `yarn test:compiler` in CI.

## 📖 Documentation

- **[Documentation site](https://vothanhdat.github.io/react-state-custom/docs/)** - Guide, API reference, benchmarks and changelog, with search.
- **[AI Context](./AI_CONTEXT.md)** - A short guide for AI assistants generating code with this library.
- **[Live Demo](https://vothanhdat.github.io/react-state-custom/)** - Interactive examples you can edit.
- **[Changelog](./CHANGELOG.md)**

## 📄 License

MIT © Vo Thanh Dat
