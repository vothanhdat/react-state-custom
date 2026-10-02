# Benchmarks

Microbenchmarks comparing `react-state-custom` with Zustand, Jotai and a plain React context, run with
`vitest bench` in jsdom. They measure the cost of the library's wiring, not of a real browser paint,
so read the ratios, not the absolute milliseconds.

```bash
yarn bench
```

## Setup

- 1000 consumer components, each reading one of 10 keys during render (100 consumers per key).
- Updates are made from outside React (`getStore().get().set()`, `store.setState()`, `store.set(atom)`,
  or the provider's `setState` for the context baseline) and wrapped in `act()`, so one iteration is
  one update plus every re-render it causes.
- No StrictMode, React 19.2, jsdom 27, Node 24, Apple M4 Pro. Numbers are means over 200 iterations
  (20 for mount); two runs agreed within a few percent.

Adapters live in [`adapters.tsx`](./adapters.tsx); each library gets the idiomatic selective subscription
(`useStore()` proxy, `useStore(store, selector)`, `useAtomValue(atom)`).

## Consumer renders

Deterministic, independent of the machine.

| library | consumer renders to mount 1000 | consumer renders per update (1 key of 10) |
|---|---|---|
| react-state-custom | 2000 | 100 |
| zustand | 1000 | 100 |
| jotai | 1000 | 100 |
| React context | 1000 | 1000 |

`react-state-custom` renders each consumer twice on mount: once to ask for the store, once when the store
hook has published. Pass `initialState` to render once when the seed already matches (see
`tests/render-count.test.tsx`). Per update, selective subscriptions re-render only the consumers that
read the changed key, like Zustand and Jotai; a plain context re-renders all of them.

## Time per operation (mean, ms)

| scenario | react-state-custom | zustand | jotai | React context |
|---|---|---|---|---|
| update 1 key, 100 of 1000 consumers affected | 0.70 | 0.41 | 0.37 | 1.51 |
| update 1 key, all 1000 consumers affected | 4.29 | 2.10 | 2.02 | 1.68 |
| mount + unmount 1000 consumers | 19.1 | 9.6 | 10.9 | 8.2 |

## Reading the numbers

- **Updates cost about 2x Zustand or Jotai.** A store in `react-state-custom` is a hook running in a headless
  component, so every update is two React commits: the store component re-renders and publishes from a
  layout effect, then the subscribed consumers re-render. Zustand and Jotai update a plain object and go
  straight to the consumers' `useSyncExternalStore`. That is the price of writing stores as ordinary hooks
  (effects, other hooks, other stores) with automatic mounting and teardown.
- **Mount costs about 2x** for the same reason: the second render per consumer above.
- **The context baseline wins when every consumer is affected anyway**: one provider `setState` re-renders
  the subtree in a single pass, while subscription-based libraries schedule a thousand individual updates.
  It loses by 10x in the common case where only some consumers care.
- At these sizes every operation is well under one frame. Choose on ergonomics unless you update
  thousands of subscribed components per frame.
