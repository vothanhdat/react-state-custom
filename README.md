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

## 🛠️ The API

```tsx
import { createStore, useMultipleStore, AutoRootCtx } from 'react-state-custom'

const { useStore, storeRef } = createStore(name, useHook, { timeToClean, schedule })

useStore(params?)                               // a proxy: the component re-renders for the keys it read
useStore(params, { select, isEqual, schedule }) // a selection
storeRef(params)                                // one instance, for code outside React: get, subscribe, retain
useMultipleStore(refs, { select, schedule })    // several instances in one call
<AutoRootCtx />                                 // mount once, near the root: it runs the store hooks
```

Stores are lazy: every key is `undefined` until the store has run once, so default at the read (`price ?? '…'`) and call actions with `?.()`. The **[Rules](https://vothanhdat.github.io/react-state-custom/docs/guide/rules)** list what the library adds to the rules of hooks, one line each; **[How it works](https://vothanhdat.github.io/react-state-custom/docs/guide/how-it-works)** has the model. Schedulers come from `react-state-custom/schedulers`, test helpers from `react-state-custom/testing`. Coming from 1.x: [Migrating to 2.0](https://vothanhdat.github.io/react-state-custom/docs/guide/migrating-to-2).

## 🆚 Compared with Jotai, RTK Query, Zustand

The closest relative is **Jotai**: both build a graph of small pieces of state, mount what is read and drop what is not. Here the unit is a hook instead of an atom, so a piece of state can do anything a hook can: `useEffect`, `useQuery`, other stores. Jotai's update path costs less (below). **RTK Query** is the closest for server data, with one cache entry per argument kept for a while after its last reader leaves; here server data, values derived from it and UI state are all written as hooks. **Zustand** is less code for a flat global bag of values with no per-id instances. The same example in Jotai and here, with a table: [For React developers](https://vothanhdat.github.io/react-state-custom/docs/guide/for-react-developers#compared-with-state-libraries).

---

## 📊 Performance

What the store saves, with 1000 consumers (`yarn bench`: vitest + jsdom, React 19.2; [full benchmarks](https://vothanhdat.github.io/react-state-custom/docs/benchmarks)):

| | react-state-custom | zustand | jotai | React context |
|---|---|---|---|---|
| consumers re-rendered when 1 key of 10 changes | 100 | 100 | 100 | 1000 |
| derive calls when a derived sum changes | 1 | 4000 | 1 | 1000 |
| derive calls when a root key no derived store reads changes | 0 | 1000 | 10 | 0 |

No selectors or memoization to write for it: a consumer subscribes to the keys it reads, a derived store runs once per update, and only when a key it read has changed.

What it costs: each update commits twice, first the store, then the consumers that read a changed key, and each derived layer adds a commit. In the same jsdom suite that is 1.3–2.1x Jotai's time when consumers re-render: 0.56 ms against 0.38 ms when 100 of 1000 consumers re-render. jsdom does no layout or paint, so these are the libraries' own costs. In headless Chrome, where each update also includes style and layout, the same scenarios cost 1.1–1.3x Jotai's: 0.65 ms against 0.57 ms.

## 📋 Requirements

- React 18 or newer (`react` and `react-dom` are peer dependencies).
- Ships ESM and CommonJS builds with TypeScript declarations.
- Development checks and warnings are removed from production bundles built with Vite, Rollup or webpack (terser): like React, the library reads `process.env.NODE_ENV`, which your bundler replaces.
- SSR-safe: on the server `useStore` returns `{}` and no store runs; stores run after hydration. In the Next.js App Router, `AutoRootCtx` and every `useStore` caller live in a `'use client'` module.
- Works with the React Compiler; covered by `yarn test:compiler` in CI.

## 📖 Documentation

- **[Documentation site](https://vothanhdat.github.io/react-state-custom/docs/)**, with search: [getting started](https://vothanhdat.github.io/react-state-custom/docs/guide/getting-started), [rules](https://vothanhdat.github.io/react-state-custom/docs/guide/rules), [for React developers](https://vothanhdat.github.io/react-state-custom/docs/guide/for-react-developers), [organizing stores in layers](https://vothanhdat.github.io/react-state-custom/docs/guide/layers), guides, [API reference](https://vothanhdat.github.io/react-state-custom/docs/api/create-store), [benchmarks](https://vothanhdat.github.io/react-state-custom/docs/benchmarks).
- **[Live demo](https://vothanhdat.github.io/react-state-custom/)**: editable examples.
- **[Trading terminal](./demos/trading)**: a realtime exchange UI (order book, charts, order ticket, account) over a simulated feed of up to ~1,100 messages a second, with stores in layers and tests per layer: `yarn demo:trading`.
- **[AI context](./AI_CONTEXT.md)**: a short guide for AI assistants generating code with this library.
- **[Changelog](./CHANGELOG.md)**

## 📄 License

MIT © Vo Thanh Dat
