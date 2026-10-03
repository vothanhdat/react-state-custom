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
    details: A store reads another store by calling it. Dependencies update by themselves, with no atoms, selectors or wiring.
  - icon: 🌊
    title: Progressive by default
    details: Each source fetches on its own. A store that combines them shows every piece as soon as it arrives.
  - icon: 🎯
    title: Selective re-renders
    details: Consumers re-render only when a key they read during render changes. Selectors cover deep and derived values.
  - icon: 🔄
    title: Automatic lifecycle
    details: A store mounts when the first caller appears and is torn down after the last one leaves. Effects clean up as usual.
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
