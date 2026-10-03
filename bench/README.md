# Benchmarks

Microbenchmarks comparing `react-state-custom` with Zustand, Jotai and a plain React context, run with
`vitest bench` in jsdom. They measure the cost of the library's wiring, not of a real browser paint,
so read the ratios, not the absolute milliseconds.

```bash
yarn bench
```

## Setup

- 1000 consumer components. Updates are made from outside React (`getStore().get().set()`,
  `store.setState()`, `store.set(atom)`, or the provider's `setState` for the context baseline) and
  wrapped in `act()`, so one iteration is one update plus every re-render and recomputation it causes.
- No StrictMode, React 19.2, jsdom 27, Node 24, Apple M4 Pro in high-power mode. Numbers are means
  over 200 iterations (20 for mount); two runs agreed within a few percent.
- Each library gets its idiomatic selective subscription: the `useStore()` proxy, `useStore(store, selector)`,
  `useAtomValue(atom)`, `useContext` + `useMemo`. Adapters: [`adapters.tsx`](https://github.com/vothanhdat/react-state-custom/blob/master/bench/adapters.tsx) (flat),
  [`derived.tsx`](https://github.com/vothanhdat/react-state-custom/blob/master/bench/derived.tsx), [`topology.tsx`](https://github.com/vothanhdat/react-state-custom/blob/master/bench/topology.tsx).
- "Lines of code" is counted by the report itself: non-blank, non-comment lines of each adapter,
  including the bench-only plumbing (render counters, the out-of-React `update`).

Three scenarios:

- **flat**: one store with 10 numeric keys, 100 consumers per key. Change one key.
- **derived**: a base store with 10 keys and a summary (`sum` of all 10) that every consumer reads.
  Change one key (sum changes), or move 1 from one key to another in a single update (sum unchanged).
- **topology**: a root config store, 10 derived stores each reading its own threshold from the root,
  100 consumers per derived store. Change one threshold, change every threshold, or change a root
  key no derived store reads.

## Consumer renders and derive calls

Deterministic, independent of the machine. "Derive calls" counts how often the derived value was
computed: the summary or mid store hook, the derived atom, the selector, or the `useMemo` factory.

| flat | consumer renders to mount | consumer renders per update | lines of code |
|---|---|---|---|
| react-state-custom | 2000 | 100 | 18 |
| zustand | 1000 | 100 | 13 |
| jotai | 1000 | 100 | 14 |
| React context | 1000 | 1000 | 18 |

| derived (renders / derive calls) | change one key | move 1 between two keys | lines of code |
|---|---|---|---|
| react-state-custom | 1000 / 1 | 0 / 1 | 22 |
| zustand | 1000 / 4000 | 0 / 1000 | 14 |
| jotai | 1000 / 1 | 0 / 1 | 15 |
| React context | 1000 / 1000 | 1000 / 1000 | 25 |

| topology (renders / derive calls) | one threshold | all thresholds | unrelated root key | lines of code |
|---|---|---|---|---|
| react-state-custom | 100 / 10 | 1000 / 10 | 0 / 0 | 22 |
| zustand | 100 / 1300 | 1000 / 4000 | 0 / 1000 | 14 |
| jotai | 100 / 10 | 1000 / 10 | 0 / 10 | 15 |
| React context | 1000 / 1000 | 1000 / 1000 | 1000 / 0 | 25 |

`react-state-custom` renders each consumer twice on mount: once to ask for the store, once when the store
hook has published. Pass `initialState` to render once when the seed already matches (see
`tests/render-count.test.tsx`; the derived and topology adapters do). Per update, selective subscriptions
re-render only the consumers that read the changed value, like Zustand and Jotai; a plain context
re-renders all of them.

Derived values are computed once per update here and in Jotai, because the derivation lives in a store
(or atom) that consumers subscribe to. In Zustand the idiomatic place for a derivation is the selector,
which runs in every consumer on every store change (`useSyncExternalStore` calls it several times per
consumer per update: 4000 calls for 1000 consumers). Moving the derivation into the store avoids that
but has to be done by hand on every write.

The "unrelated root key" column shows what the proxy buys inside stores: a derived store that only read
`thresholds` is not re-run when `label` changes, so nothing downstream happens at all. Jotai recomputes
the 10 derived atoms (they depend on the whole root atom; splitting the root into one atom per key would
avoid it) and Zustand runs 1000 selectors; both then stop because the values are unchanged.

## Time per operation (mean, ms)

| scenario | react-state-custom | zustand | jotai | React context |
|---|---|---|---|---|
| flat: update 1 key, 100 of 1000 consumers affected | 0.72 | 0.50 | 0.38 | 1.49 |
| flat: update 1 key, all 1000 consumers affected | 4.87 | 2.36 | 2.00 | 1.87 |
| flat: mount + unmount 1000 consumers | 18.5 | 8.7 | 9.2 | 8.7 |
| derived: change one key (sum changes) | 4.49 | 4.28 | 2.04 | 3.14 |
| derived: move 1 between two keys (sum unchanged) | 0.044 | 0.56 | 0.002 | 2.73 |
| topology: one threshold (100 affected) | 0.81 | 0.47 | 0.40 | 1.60 |
| topology: all thresholds (1000 affected) | 4.80 | 1.95 | 2.14 | 2.00 |
| topology: unrelated root key (none affected) | 0.018 | 0.019 | 0.014 | 1.55 |

## Reading the numbers

- **Updates that re-render consumers cost about 2x Zustand or Jotai.** A store in `react-state-custom`
  is a hook running in a headless component, so every update is two React commits: the store component
  re-renders and publishes from a layout effect, then the subscribed consumers re-render. Zustand and Jotai
  update a plain object and go straight to the consumers' `useSyncExternalStore`. That is the price of
  writing stores as ordinary hooks (effects, other hooks, other stores) with automatic mounting and
  teardown. Mount costs about 2x for the same reason: the second render per consumer above.
- **When a derivation is involved the gap to Zustand closes** (4.49 vs 4.28 ms) because its selectors
  recompute in every consumer, and when the derived value does not change we are 12x faster than Zustand
  (0.04 vs 0.56 ms): one store re-render instead of 1000 selector runs. Jotai, whose atom graph is built
  for exactly this, stays fastest in every scenario.
- **Updates nothing reads are free** in all three subscription libraries (under 0.02 ms); only the
  context baseline re-renders its thousand consumers.
- **The context baseline wins when every consumer is affected anyway**: one provider `setState` re-renders
  the subtree in a single pass, while subscription-based libraries schedule a thousand individual updates.
  It loses by 10x whenever only some consumers care.
- **Lines of code favour Zustand for a bag of values**: `createStore(() => init)` plus a one-line selector
  is hard to beat. The hook form pays off when a store has effects, async work or composes other stores,
  which these scenarios do not exercise; the topology adapter shows the shape (a store reading another
  store with one hook call) but not the payoff.
- At these sizes every operation is well under one frame. Choose on ergonomics unless you update
  thousands of subscribed components per frame.
