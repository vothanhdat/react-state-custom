# React State Custom

**Write a hook once, use it anywhere.**

One running instance per params, shared by every component and every store that calls it. Composed with hooks, rendered as soon as each piece arrives.

[![Docs](https://img.shields.io/badge/Docs-Website-2563eb?style=flat-square)](https://vothanhdat.github.io/react-state-custom/docs/)
[![Demo](https://img.shields.io/badge/Demo-Live-blue?style=flat-square)](https://vothanhdat.github.io/react-state-custom/)
[![npm version](https://img.shields.io/npm/v/react-state-custom?style=flat-square)](https://www.npmjs.com/package/react-state-custom)
[![Coverage](https://img.shields.io/codecov/c/github/vothanhdat/react-state-custom?style=flat-square)](https://codecov.io/gh/vothanhdat/react-state-custom)
[![React 18+](https://img.shields.io/badge/React-18%2B-61dafb?style=flat-square)](#-requirements)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

```bash
npm install react-state-custom
```

📚 **[Documentation →](https://vothanhdat.github.io/react-state-custom/docs/)** · 🎮 **[Live Demo →](https://vothanhdat.github.io/react-state-custom/)**

---

## ⚡ The 30-Second Pitch

A custom hook is reused as code, not as state. Call `useTicker('BTC')` in three components and the hook runs three times: three `useState`s, three socket subscriptions, three values that can drift apart.

Wrap the same hook with `createStore` and those three components share **one** running instance: one state, one subscription.

```tsx
// plain custom hook: every call is its own instance
<Header />     // useTicker('BTC') → own useState, socket subscription #1
<Chart />      // useTicker('BTC') → own useState, socket subscription #2
<OrderForm />  // useTicker('BTC') → own useState, socket subscription #3

// store: every call shares one instance
<Header />     // useTicker({ symbol: 'BTC' }) ┐
<Chart />      // useTicker({ symbol: 'BTC' }) ├─ one useState, one subscription
<OrderForm />  // useTicker({ symbol: 'BTC' }) ┘
```

- **Shared, not duplicated.** Call a store in ten components or in other stores: the hook runs once per params, and each caller re-renders only for the keys it reads.
- **Composed with hooks.** A store reads another store by calling it. Dependencies update by themselves.
- **Progressive by default.** Each source fetches on its own; a store that combines them shows every piece as soon as it arrives. See [Progressive data](https://vothanhdat.github.io/react-state-custom/docs/guide/progressive-data).

```tsx
import { useEffect, useState } from 'react'
import { createStore, AutoRootCtx } from 'react-state-custom'

// 1. A hook, written as usual: the live price of one symbol
const useTickerState = ({ symbol }: { symbol: string }) => {
  const [price, setPrice] = useState<number>()
  useEffect(() => socket.subscribe(`ticker:${symbol}`, setPrice), [symbol])
  return { price }
}
export const { useStore: useTicker } = createStore('ticker', useTickerState)

// 2. Another store uses it, like a hook calling a hook
const usePositionState = ({ symbol }: { symbol: string }) => {
  const [position, setPosition] = useState<Position>()
  useEffect(() => { fetchPosition(symbol).then(setPosition) }, [symbol])
  const { price } = useTicker({ symbol })
  return { pnl: price !== undefined && position ? (price - position.entry) * position.qty : undefined }
}
export const { useStore: usePosition } = createStore('position', usePositionState)

// 3. Mount AutoRootCtx once, near the root
<AutoRootCtx />

// 4. Call the stores like hooks, anywhere
const Price = ({ symbol }: { symbol: string }) => {
  const { price } = useTicker({ symbol })
  return <b>{price ?? '…'}</b>
}
const Pnl = ({ symbol }: { symbol: string }) => {
  const { pnl } = usePosition({ symbol })
  return <b>{pnl ?? '…'}</b>
}
```

`<Price symbol="BTC" />` in the header, another in the order form, and the `position` store all ask for the BTC ticker: the socket is subscribed **once**. The price shows on the first tick, the P&L as soon as the position has loaded too. When the last of them unmounts, the subscription is cleaned up. No provider per store, no selectors, no loading logic in the view.

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

- **Start**: [getting started](https://vothanhdat.github.io/react-state-custom/docs/guide/getting-started), [how it works](https://vothanhdat.github.io/react-state-custom/docs/guide/how-it-works)
- **Stores**: [store options](https://vothanhdat.github.io/react-state-custom/docs/guide/store-options) (`initialState`, `timeToClean`, `AttachedComponent`, `schedule`), [organizing stores in layers](https://vothanhdat.github.io/react-state-custom/docs/guide/layers), [events from a store](https://vothanhdat.github.io/react-state-custom/docs/guide/events), [realtime data](https://vothanhdat.github.io/react-state-custom/docs/guide/realtime), [parameterized stores](https://vothanhdat.github.io/react-state-custom/docs/guide/parameterized-stores), [composing stores](https://vothanhdat.github.io/react-state-custom/docs/guide/composing-stores), [progressive data](https://vothanhdat.github.io/react-state-custom/docs/guide/progressive-data), [scopes](https://vothanhdat.github.io/react-state-custom/docs/guide/scopes) with `StateScopeProvider`, [error handling](https://vothanhdat.github.io/react-state-custom/docs/guide/error-handling)
- **Reading state**: [selectors](https://vothanhdat.github.io/react-state-custom/docs/guide/selectors), [update cadence](https://vothanhdat.github.io/react-state-custom/docs/guide/update-cadence) (render a reader per frame, throttled, debounced or when idle), [nested objects](https://vothanhdat.github.io/react-state-custom/docs/guide/composing-stores#flatten-a-nested-source), [Suspense](https://vothanhdat.github.io/react-state-custom/docs/guide/suspense), [concurrent rendering](https://vothanhdat.github.io/react-state-custom/docs/guide/concurrent), [outside React](https://vothanhdat.github.io/react-state-custom/docs/guide/outside-react) with `getStore()`, [reads outside render](https://vothanhdat.github.io/react-state-custom/docs/guide/reads-outside-render)
- **Integration**: [developer tools](https://vothanhdat.github.io/react-state-custom/docs/guide/devtools), [server-side rendering](https://vothanhdat.github.io/react-state-custom/docs/guide/ssr), [React Compiler](https://vothanhdat.github.io/react-state-custom/docs/guide/react-compiler), [testing](https://vothanhdat.github.io/react-state-custom/docs/guide/testing), [limitations and FAQ](https://vothanhdat.github.io/react-state-custom/docs/guide/limitations)
- **[API reference](https://vothanhdat.github.io/react-state-custom/docs/api/create-store)**: every export, including the low-level primitives

---

## 🆚 Comparison

The closest relative is **Jotai**: both build a graph of small pieces of state that depend on each other, mount what is read and drop what is not. The difference is the unit. In Jotai it is an atom, a value or a derived read. Here it is a hook, so a piece of state can do anything a hook can do.

The same slice of an exchange UI, an order book per symbol fed by a socket, and a spread derived from it:

```ts
// Jotai 3 (atomFamily comes from the jotai-family package; it left jotai/utils in Jotai 3)
const bookAtom = atomFamily((symbol: string) => {
  const a = atom<Book | null>(null)
  a.onMount = set => socket.subscribe(symbol, set)        // returns the unsubscribe
  return a
})
const spreadAtom = atomFamily((symbol: string) => atom(get => spreadOf(get(bookAtom(symbol)))))

const spread = useAtomValue(spreadAtom(symbol))
```

```ts
// react-state-custom
export const { useStore: useBook } = createStore('book', ({ symbol }: { symbol: string }) => {
  const [book, setBook] = useState<Book | null>(null)
  useEffect(() => socket.subscribe(symbol, setBook), [symbol])
  return { book }
})
export const { useStore: useSpread } = createStore('spread', ({ symbol }: { symbol: string }) => {
  const { book } = useBook({ symbol })
  return { spread: book ? spreadOf(book) : undefined }
})

const { spread } = useSpread({ symbol })
```

Both subscribe to the socket when the first component reads that symbol and unsubscribe after the last one leaves. What differs is what you had to learn and what it costs:

| | react-state-custom | Jotai |
|:---|:---|:---|
| **Unit** | a hook: `useState`, `useEffect`, `useQuery`, other stores | an atom: a value or a derived `get` |
| **Depend on another piece** | call its hook | `get(otherAtom)` |
| **One instance per symbol, id, …** | params on the hook; same params, same instance | `atomFamily` (`jotai-family`) |
| **Side effects with a lifecycle** | `useEffect` inside the store | `onMount` on the atom |
| **Fine-grained reads** | top-level keys through the proxy, selectors for deep values | one atom per value; split atoms for granularity |
| **Cost per update** | when consumers re-render, 1.6–2.6x Jotai's in jsdom and 1.1–1.6x in Chrome; one more commit per derived layer | lower whenever consumers re-render, in our jsdom and Chrome [benchmarks](https://vothanhdat.github.io/react-state-custom/docs/benchmarks) |
| **Ecosystem** | every React hook works inside a store | a large set of atom utilities |
| **To learn** | nothing beyond React hooks | the atom model |

Jotai's update path costs less: it updates atoms outside React and renders the consumers in one commit. If your state is a graph of things that fetch, subscribe and derive, such as `config → market data → order book → positions → summary`, write each node as a hook, keep the graph acyclic, and import the hook where it is needed.

**RTK Query** is the closest for server data: one cache entry per endpoint argument, reference-counted while components use it, kept for `keepUnusedDataFor` after the last one leaves (`timeToClean` here), and fed by a socket through `onCacheEntryAdded`. It adds Redux, cache invalidation and its devtools; the entry holds what the endpoint returns, and derived values go through selectors. Here a store is any hook, so server data, values derived from it and UI state such as a draft order are written the same way.

**Zustand** is the least code for a flat global bag of values, with no per-key instances or lifecycle: you write the ref-counting around sockets yourself. **Redux** is a different model (actions and reducers) aimed at a different scale of ceremony. A plain **React context** re-renders every consumer on every change.

## 📊 Performance

What the store saves, with 1000 consumers (`yarn bench`: vitest + jsdom, React 19.2; [full benchmarks](https://vothanhdat.github.io/react-state-custom/docs/benchmarks)):

| | react-state-custom | zustand | jotai | React context |
|---|---|---|---|---|
| consumers re-rendered when 1 key of 10 changes | 100 | 100 | 100 | 1000 |
| derive calls when a derived sum changes | 1 | 4000 | 1 | 1000 |
| derive calls when a root key no derived store reads changes | 0 | 1000 | 10 | 0 |

No selectors or memoization to write for it: a consumer subscribes to the keys it reads, a derived store runs once per update, and only when a key it read has changed.

What it costs: each update commits twice, first the store, then the consumers that read a changed key, and each derived layer adds a commit. In the same jsdom suite that is 1.6–2.6x Jotai's time when consumers re-render: 0.72 ms against 0.38 ms when 100 of 1000 consumers re-render. jsdom does no layout or paint, so these are the libraries' own costs. In headless Chrome, where each update also includes style and layout, the same scenarios cost 1.1–1.6x Jotai's: 0.86 ms against 0.68 ms.

---

## 📋 Requirements

- React 18 or newer (`react` and `react-dom` are peer dependencies).
- Ships ESM and CommonJS builds with TypeScript declarations.
- Development checks and warnings are removed from production bundles built with Vite, Rollup or webpack (terser): like React, the library reads `process.env.NODE_ENV`, which your bundler replaces.
- SSR-safe: consumers render `initialState` on the server, stores run after hydration. In the Next.js App Router, `AutoRootCtx` and every `useStore` caller live in a `'use client'` module.
- Works with the React Compiler; covered by `yarn test:compiler` in CI.

## 📖 Documentation

- **[Documentation site](https://vothanhdat.github.io/react-state-custom/docs/)** - Guide, API reference, benchmarks and changelog, with search.
- **[AI Context](./AI_CONTEXT.md)** - A short guide for AI assistants generating code with this library.
- **[Live Demo](https://vothanhdat.github.io/react-state-custom/)** - Interactive examples you can edit.
- **[Trading terminal](./demos/trading)** - A realtime exchange UI (order book, charts, order ticket, account) over a simulated feed of up to ~1,100 messages a second, with stores in layers and tests per layer: `yarn demo:trading`.
- **[Changelog](./CHANGELOG.md)**

## 📄 License

MIT © Vo Thanh Dat
