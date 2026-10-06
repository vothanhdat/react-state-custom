---
layout: home

hero:
  name: react-state-custom
  text: The "it's just a hook" state manager
  tagline: Write a hook once, use it anywhere. One running instance per params, shared by every component and store that calls it.
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
    title: Shared, not duplicated
    details: Call a store like a hook, in any component or in other stores. The hook runs once per params, however many places call it.
  - icon: 🧩
    title: Composed with hooks
    details: A store reads another store by calling it, and a list of instances with useMultipleStore. Dependencies update by themselves, with no atoms, selectors or wiring.
  - icon: 🌊
    title: Progressive by default
    details: Each source fetches on its own. A store that combines them shows every piece as soon as it arrives.
  - icon: 🎯
    title: Selective re-renders
    details: Consumers re-render only when a key they read during render changes. A selector covers derived values, a schedule how often to render (once a frame, throttled, when idle).
  - icon: 🔄
    title: Automatic lifecycle
    details: A store mounts when the first caller appears and is torn down after the last one leaves. One that throws fails alone, and its readers throw to their error boundary.
  - icon: 🛡️
    title: TypeScript and modern React
    details: Params and state are inferred from your hook. Tested under StrictMode and the React Compiler.
---

## Thirty seconds

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

```bash
npm install react-state-custom
```

## When it fits

A store pays off when several components need the same running piece of state, effects included, per id.

- **A good fit**
  - A socket, a presence channel or a poll per room, symbol or document, read by several widgets: one subscription and one state for all of them.
  - A task in progress, such as an upload or an export, followed on more than one screen. See [Keep a task running after its screen closes](/guide/outside-react#keep-a-task-running-after-its-screen-closes).
  - A screen's state combined from several sources: fetched data, a socket, the session. See [Progressive data](/guide/progressive-data).
  - Domain hooks you already have and now need to share: wrap them with `createStore` and they run as written.
- **A small gain**
  - Global UI flags such as the theme or an open modal: a context or a plain store does this already.
  - Server data you only fetch and cache: a query library already shares responses per key. Combine its results in a store when you need more.
  - State that belongs to one component: keep it in `useState`.
- **Not a fit**
  - Logic that must run without React. A store is a hook: `storeRef()` reads and drives it from outside, but it runs only under a mounted `AutoRootCtx`.

Sharing changes behaviour: callers with the same params share everything the hook holds. Decide what belongs to the shared instance and what stays with each view; see [What an instance shares](/guide/parameterized-stores#what-an-instance-shares).

## Where to go next

- New to the library: [Getting started](/guide/getting-started), then the [Rules](/guide/rules).
- Know React well: [For React developers](/guide/for-react-developers), with the comparison with Jotai, RTK Query and Zustand, and what it costs.
- Coming from 1.x: [Migrating to 2.0](/guide/migrating-to-2).
- The [live demo](https://vothanhdat.github.io/react-state-custom/) has editable examples. Live Rooms shows the model best: one connection per room shared by several widgets, closed with the room, and messages kept in a store of their own.
