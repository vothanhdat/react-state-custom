# React State Custom

**The "It's Just a Hook" State Manager for React.**

Turn any React hook into a global store. Zero boilerplate. Full type safety. Automatic lifecycle management.

[![Demo](https://img.shields.io/badge/Demo-Live-blue?style=flat-square)](https://vothanhdat.github.io/react-state-custom/)
[![npm version](https://img.shields.io/npm/v/react-state-custom?style=flat-square)](https://www.npmjs.com/package/react-state-custom)
[![React 18+](https://img.shields.io/badge/React-18%2B-61dafb?style=flat-square)](#requirements)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

```bash
npm install react-state-custom
```

🎮 **[Try the Live Demo →](https://vothanhdat.github.io/react-state-custom/)**

---

## ⚡ The 30-Second Pitch

Stop writing reducers, actions, and manual providers. If you can write a React hook, you've already written your store.

```tsx
import { createStore, AutoRootCtx } from 'react-state-custom'

// 1. Write a standard hook (your store logic)
const useCountState = ({ initial = 0 }: { initial?: number }) => {
  const [count, setCount] = useState(initial)
  const increment = () => setCount(c => c + 1)
  return { count, increment }
}

// 2. Create a store
export const { useStore } = createStore('counter', useCountState)

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

## 🚀 Why React State Custom?

Most state libraries force you to learn a new way to write logic (reducers, atoms, proxies). **React State Custom** lets you use the React skills you already have.

### 💎 Zero Boilerplate
Define state with `useState`, `useEffect`, `useMemo`. No new syntax to learn.

### 🎯 Selective Re-renders
Components only re-render when the specific data they use changes. Performance is built-in.

### 🔄 Automatic Lifecycle
Stores are created when needed and destroyed when unused. No more manual cleanup or memory leaks.

### 🛡️ TypeScript First
Full type inference out of the box. Your IDE knows exactly what's in your store.

---

## 🛠️ Quick Start

### 1. Define Your State
Write a hook that returns the data and actions you want to share.

```typescript
// features/userState.ts
import { useState, useEffect } from 'react'

export const useUserState = ({ userId }: { userId: string }) => {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetchUser(userId).then(setUser)
  }, [userId])

  return { user, isLoading: !user }
}
```

### 2. Create the Store
Use `createStore` to generate a hook for your components.

```typescript
import { createStore } from 'react-state-custom'
import { useUserState } from './features/userState'

export const { useStore: useUserStore } = createStore('user', useUserState, {
  initialState: { user: null, isLoading: true },
})
```

### 3. Mount the Root (Once)
Add `<AutoRootCtx />` to your app's root. This component manages all your stores automatically.

```tsx
// App.tsx
import { AutoRootCtx } from 'react-state-custom'

export default function App() {
  return (
    <>
      <AutoRootCtx />
      <YourAppContent />
    </>
  )
}
```

### 4. Use It Anywhere
Call the generated hook in any component. Destructure the keys you need during render.

```tsx
function UserName({ userId }: { userId: string }) {
  const { user, isLoading } = useUserStore({ userId })
  if (isLoading) return <Spinner />
  return <span>{user.name}</span>
}
```

Two components rendering `useUserStore({ userId: '42' })` share one store instance and one fetch.

---

## 📚 Guide

### 🌱 Initial State

Before a store's hook has run for the first time, its values read as `undefined`. Pass `initialState` to give consumers something on the very first render. Keys you list there are typed as always present.

```tsx
export const { useStore: useUserStore } = createStore('user', useUserState, {
  initialState: { user: null, isLoading: true },
})

const { user, isLoading } = useUserStore({ userId }) // never undefined
```

Stores without required params can be used as `useStore()`.

### ⚙️ Store Options

```tsx
createStore('name', useFn, {
  initialState: { ... },     // see above
  timeToClean: 5000,         // keep the instance alive 5s after its last consumer unmounts (default 0)
  AttachedComponent: Logger, // optional component rendered next to each store instance, receives params
})
```

A bare number is accepted as `timeToClean`: `createStore('name', useFn, 5000)`.

### 🆔 Parameterized Stores

Params are serialized into the store's identity, so the same definition can serve many independent instances.

```tsx
const { useStore: useTodoStore } = createStore('todos', useTodoState)

useTodoStore({ listId: 'work' })     // instance A
useTodoStore({ listId: 'personal' }) // instance B
useTodoStore({ listId: 'work' })     // instance A again, shared
```

Rules:
- Params must be primitives: `string`, `number`, `bigint`, `boolean`, `null` or `undefined`. Passing an object or a function as a param throws.
- Key order does not matter. `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` are the same instance.

### 🧩 Composing Stores

A store hook can call other stores. Dependencies update automatically.

```tsx
const useSettingsState = () => {
  const [taxRate, setTaxRate] = useState(0.1)
  return { taxRate, setTaxRate }
}
export const { useStore: useSettingsStore } = createStore('settings', useSettingsState)

const useInvoiceState = ({ invoiceId }: { invoiceId: string }) => {
  const { taxRate } = useSettingsStore() // store inside store
  const [subtotal, setSubtotal] = useState(0)
  return { subtotal, setSubtotal, total: subtotal * (1 + (taxRate ?? 0)) }
}
export const { useStore: useInvoiceStore } = createStore('invoice', useInvoiceState)
```

Derived values that are only needed by one component can stay in a plain hook:

```tsx
const useCartTotal = () => {
  const { items = [] } = useCartStore()
  return items.reduce((total, item) => total + item.price, 0)
}
```

A cycle (A reads B, B reads A) is reported with a development warning.

### 🎭 Isolated State

Need to run multiple independent instances of your application or isolate a feature? Use `StateScopeProvider`.

```tsx
import { AutoRootCtx, StateScopeProvider } from 'react-state-custom'

function App() {
  return (
    <>
      <AutoRootCtx /> {/* Global Scope */}
      <MainApp />

      <StateScopeProvider>
         {/* Isolated Scope - Stores here are independent of Global Scope */}
         <IsolatedFeature />
      </StateScopeProvider>
    </>
  )
}
```

Stores used inside `StateScopeProvider` are completely isolated from the parent or global scope, even if they share the same store definition. A `StateScopeProvider` is its own root: it does not need an `AutoRootCtx` inside it.

### 🛡️ Error Handling

Each store instance is wrapped in `StoreErrorBoundary` by default. If a store hook throws, that store is disabled and the error logged; every other store and your UI keep running. Pass your own `Wrapper` to render a fallback or report the error:

```tsx
import { ErrorBoundary } from 'react-error-boundary'

<AutoRootCtx Wrapper={({ children }) => (
  <ErrorBoundary fallback={null} onError={reportError}>{children}</ErrorBoundary>
)} />
```

### 🔎 Selectors

Pass a selector to re-render only when a derived or deep value changes. The selector gets the plain state object, so it can read as deep as it likes; comparison is `Object.is` unless you pass your own.

```tsx
const name = useUserStore({ userId }, s => s.user?.name)
const total = useCartStore(undefined, s => s.items.reduce((sum, i) => sum + i.price, 0))
const tags = usePostStore({ id }, s => s.post?.tags ?? [], shallowEqual)
```

### ⏳ Suspense

`useStoreSuspense` suspends until the store hook has run once, or until an `isReady` predicate holds, and returns the full state type with nothing `undefined`.

```tsx
function Profile({ userId }: { userId: string }) {
  const { user } = useUserStoreSuspense({ userId }, s => !s.isLoading)
  return <h1>{user.name}</h1>
}

<Suspense fallback={<Spinner />}>
  <Profile userId="42" />
</Suspense>
```

The store keeps running while the component is suspended. On the server it throws unless `initialState` already satisfies `isReady`, so keep it inside a client-only boundary.

### 🧰 Outside React

`getStore(params)` is an imperative handle for code that is not a component: socket handlers, routers, tests, or an event handler that needs the latest value without subscribing.

```tsx
const cart = getCartStore({ userId: '42' })

cart.get().items          // plain snapshot, safe anywhere
cart.get().addItem(item)  // actions are part of the state
const stop = cart.subscribe((state, changedKey) => sync(state))

const release = cart.retain() // keep the store running with no component reading it
release()
```

`getStore` works in the global scope. Inside a `StateScopeProvider`, components reach their instance through `useCtxState`.

### 📏 Reading Outside Render

The object returned by `useStore` is a proxy that tracks reads **during render**. Reading it later (in an event handler or effect) returns the current value, but does not subscribe and logs a one-time development warning. Destructure what you need at the top of the component instead:

```tsx
// ✅
const { count, increment } = useStore()
const onClick = () => console.log(count)

// ⚠️ not tracked
const store = useStore()
const onClick = () => console.log(store.count)

// ✅ latest value in a handler without subscribing
const onClick = () => console.log(getStore().get().count)
```

### 🔌 Developer Tools

Inspect your state in real-time with the built-in DevTools. They live in a separate entry so nothing reaches your production bundle unless you import it.

```tsx
import { DevToolContainer } from 'react-state-custom/dev-tool'
import 'react-state-custom/style.css'

<DevToolContainer />
```

---

## 🆚 Comparison

| Feature | React State Custom | Redux | Context API | Zustand |
|:---|:---:|:---:|:---:|:---:|
| **Paradigm** | Just Hooks 🪝 | Actions/Reducers | Providers | Store Object |
| **Boilerplate** | 🟢 None | 🔴 High | 🟡 Medium | 🟢 Low |
| **Auto Lifecycle** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Selective Renders** | ✅ Automatic | ⚠️ Selectors | ❌ Manual | ✅ Selectors |
| **Learning Curve** | 🟢 Low | 🔴 High | 🟡 Medium | 🟢 Low |

---

## 🖥️ Server-Side Rendering

React State Custom is a **client-side** state manager that is **SSR-safe**. Stores are hooks that run inside `<AutoRootCtx />` after mount, and effects never run on the server, so:

- On the server, consumers render with `initialState` (or `undefined`). No store hook runs, nothing is fetched, nothing leaks between requests (server renders use throwaway contexts, never the shared cache).
- Hydration matches, because the client's first render reads the very same snapshot. Stores mount after hydration and consumers update from there.
- With streaming (`renderToPipeableStream`) the same rule holds: every boundary renders the same `initialState`.

Give stores an `initialState` so server HTML shows a meaningful loading state instead of empty values.

**Next.js App Router:** everything here is a hook, so `AutoRootCtx`, `StateScopeProvider` and any component calling `useStore` must live in a `'use client'` module.

---

## 📋 Requirements

- React 18 or newer (`react` and `react-dom` are peer dependencies).
- Ships ESM and CommonJS builds with TypeScript declarations. TypeScript is optional but recommended.

## 📖 Documentation

- **[API Reference](./API_DOCUMENTATION.md)** - Every export, including the low-level primitives.
- **[AI Context](./AI_CONTEXT.md)** - A short guide for AI assistants generating code with this library.
- **[Live Demo](https://vothanhdat.github.io/react-state-custom/)** - Interactive examples you can edit.
- **[Changelog](./CHANGELOG.md)**

## 📄 License

MIT © Vo Thanh Dat
