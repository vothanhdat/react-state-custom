# Benchmarks

Microbenchmarks comparing `react-state-custom` with Zustand, Jotai and a plain React context, run with
`vitest bench` in jsdom. They measure the cost of the library's wiring, not of a real browser paint,
so read the ratios, not the absolute milliseconds. The same scenarios also run in headless Chrome,
with style and layout included, plus a nested-state scenario: see [In a browser](#in-a-browser).

```bash
yarn bench           # jsdom
yarn bench:browser   # headless Chrome, about 10 minutes
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
- "Tokens" is the code size of each adapter as the report measures it: TypeScript tokens of the adapter's
  source (whitespace and comments excluded, so independent of how lines are wrapped), including the
  bench-only plumbing (render counters, the out-of-React `update`, a unique store name per run).

Five scenarios:

- **flat**: one store with 10 numeric keys, 100 consumers per key. Change one key.
- **derived**: a base store with 10 keys and a summary (`sum` of all 10) that every consumer reads.
  Change one key (sum changes), or move 1 from one key to another in a single update (sum unchanged).
- **topology**: a root config store, 10 derived stores each reading its own threshold from the root,
  100 consumers per derived store. Change one threshold, change every threshold, or change a root
  key no derived store reads.
- **shop**: a four-layer graph. `config { vat, discount, theme }` and `items { [id]: { price, qty } }`
  (100 items) feed 100 lines (`price × qty × (1 − discount)`), 10 checkouts (10 lines each, `× (1 + vat)`)
  and one summary. 500 consumers read a line, 300 a checkout, 200 the summary. Change one item's qty,
  `vat`, `theme` (nothing derived reads it) or `discount`.
  `react-state-custom` has one store per layer returning a flat object (`lines` keyed by item id,
  `checkouts` by group); each store calls the hook of the layer below once and reads the keys it needs.
  Zustand keeps the derived values in the store and recomputes them on every write (the usual pattern;
  computing them in selectors instead would run the whole chain in every consumer). Jotai gets one atom
  per config key and per item plus derived atoms per line, checkout and the summary.
- **collection**: 200 numeric items, 5 consumers per item, one item changed. `react-state-custom` appears
  twice: items spread as top-level store keys (the recommended shape), and the whole array under one key.

## Consumer renders and derive calls

Deterministic, independent of the machine. "Derive calls" counts how often the derived value was
computed: the summary or mid store hook, the derived atom, the selector, or the `useMemo` factory.

| flat | consumer renders to mount | consumer renders per update | tokens |
|---|---|---|---|
| react-state-custom | 2000 | 100 | 208 |
| zustand | 1000 | 100 | 138 |
| jotai | 1000 | 100 | 147 |
| React context | 1000 | 1000 | 211 |

| derived (renders / derive calls) | change one key | move 1 between two keys | tokens |
|---|---|---|---|
| react-state-custom | 1000 / 1 | 0 / 1 | 227 |
| zustand | 1000 / 4000 | 0 / 1000 | 138 |
| jotai | 1000 / 1 | 0 / 1 | 158 |
| React context | 1000 / 1000 | 1000 / 1000 | 241 |

| topology (renders / derive calls) | one threshold | all thresholds | unrelated root key | tokens |
|---|---|---|---|---|
| react-state-custom | 100 / 10 | 1000 / 10 | 0 / 0 | 247 |
| zustand | 100 / 1300 | 1000 / 4000 | 0 / 1000 | 165 |
| jotai | 100 / 10 | 1000 / 10 | 0 / 10 | 185 |
| React context | 1000 / 1000 | 1000 / 1000 | 1000 / 0 | 231 |

| shop (renders / derive calls) | qty of one item | vat | theme | discount | tokens |
|---|---|---|---|---|---|
| react-state-custom | 235 / 111 | 500 / 11 | 0 / 0 | 1000 / 111 | 556 |
| zustand | 235 / 111 | 500 / 111 | 0 / 111 | 1000 / 111 | 307 |
| jotai | 235 / 3 | 500 / 11 | 0 / 0 | 1000 / 111 | 470 |
| React context | 1000 / 111 | 1000 / 111 | 1000 / 111 | 1000 / 111 | 361 |

| collection | consumer renders per update | tokens |
|---|---|---|
| react-state-custom | 5 | 202 |
| react-state-custom, array in one key | 1000 | 205 |
| zustand | 5 | 163 |
| jotai | 5 | 148 |
| React context | 1000 | 206 |

`react-state-custom` renders each consumer twice on mount: once to ask for the store, once when the store
hook has published. Pass `initialState` to render once when the seed already matches (see
`tests/render-count.test.tsx`). The adapters here stay lazy, as the library is designed: no `initialState`,
and a derived layer defaults with `??` or `?.` while the layer below has not published yet. Per update, selective subscriptions
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

The shop graph shows the same thing at depth, with one difference. A store re-runs only when a key it
read changes: `vat` skips the 100 lines (11 derive calls), `theme` does nothing. But the `lines` store
reads every item and recomputes all 100 lines when one qty changes, publishing only the one that changed
(111 derive calls, 235 renders). Granularity stops at the store: a layer is one hook call, and reading 10
instances of a parameterised store from another store would mean calling its hook in a loop, which the
rules of hooks forbid. Jotai gets to 3 derive calls because each line is its own atom and `get` is not a
hook; Zustand's precomputed derivations recompute all 111 values on every write, `theme` included.

The collection table is the limitation and its remedy side by side: the proxy tracks top-level keys, so
an array under one key re-renders every reader on any change, while the same items spread as keys
re-render only the five readers of the changed item, like a Zustand selector or a Jotai atom per item.

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
| shop: qty of one item (235 affected) | 1.61 | 0.60 | 0.62 | 1.69 |
| shop: vat (500 affected) | 2.25 | 1.10 | 1.34 | 1.61 |
| shop: theme (none affected) | 0.016 | 0.052 | 0.0006 | 1.50 |
| shop: discount (1000 affected) | 5.10 | 2.18 | 2.54 | 2.01 |
| collection: one of 200 items, 5 of 1000 consumers affected | 0.30 | 0.25 | 0.19 | 1.67 |
| collection: same, array under one key (1000 affected) | 4.16 | | | |

## Reading the numbers

- **Updates that re-render consumers cost 1.6–2.6x Jotai and up to 2.7x Zustand** (1.1–1.6x Jotai in Chrome, see
  [In a browser](#in-a-browser)). A store in `react-state-custom`
  is a hook running in a headless component, so every update is two React commits: the store component
  re-renders and publishes from a layout effect, then the subscribed consumers re-render. Zustand and Jotai
  update a plain object and go straight to the consumers' `useSyncExternalStore`. That is the price of
  writing stores as ordinary hooks (effects, other hooks, other stores) with automatic mounting and
  teardown. Mount costs about 2x for the same reason: the second render per consumer above.
- **When a derivation is involved the gap to Zustand closes** (4.49 vs 4.28 ms) because its selectors
  recompute in every consumer, and when the derived value does not change we are 12x faster than Zustand
  (0.04 vs 0.56 ms): one store re-render instead of 1000 selector runs. Jotai, whose atom graph is built
  for exactly this, is fastest in both.
- **Every derived layer is one more React commit.** In the shop graph a qty change travels items → lines →
  checkouts → summary → consumers, and each store on the way renders and publishes in its own commit, so
  the gap to Zustand and Jotai grows to about 2.6x (1.61 vs 0.60 and 0.62 ms). Zustand and Jotai propagate
  through plain objects and commit once.
- **Updates nothing reads are free** in all three subscription libraries (under 0.02 ms); only the
  context baseline re-renders its thousand consumers.
- **The context baseline wins when every consumer is affected anyway**: one provider `setState` re-renders
  the subtree in a single pass, while subscription-based libraries schedule a thousand individual updates.
  It loses by 10x whenever only some consumers care.
- **Code size favours Zustand and Jotai in every scenario**, by roughly 1.5x. `createStore(() => init)`
  plus a one-line selector, or an `atom` per value, is hard to beat; our layer is
  `createStore(name, hook)` with `useState` inside, and a write from outside React is `getStore().get().action()`
  instead of `store.setState()`. Some of the difference is bench plumbing (a unique name per run, typed
  casts), but the shape is real: the hook form costs more words per layer. None of them are library
  ceremony, though: there is no store object, selector, atom or provider to write, only `createStore` and
  the hook it returns; the extra tokens are the `useState` and the `??` defaults inside the hook itself.
  What the hook form buys is not brevity but that each layer can hold effects, async work and other hooks,
  which these scenarios do not exercise.
- jsdom does no layout or paint, so these numbers are the libraries' own work. In a page, the DOM work of
  the components an update re-renders comes on top, and is the same in every library for the same
  re-renders. Choose on ergonomics.

## In a browser

`yarn bench:browser` runs the scenarios above in headless Chrome with the same adapters, and adds a
nested-state scenario ([`bench/browser`](https://github.com/vothanhdat/react-state-custom/tree/master/bench/browser)).

- A production build without StrictMode. A sample is one update inside `flushSync`, every render and
  commit it causes included, followed by a forced layout read: style and layout count, paint does not.
  The page gets a frame every 10 updates, outside the samples.
- Three rounds in a shuffled order; per case and round, 20 warm-up and 100 timed updates (10 and 40 in
  the nested scenario). The tables show the median of all samples of a case. Raw samples, versions and
  machine: [`results.json`](https://github.com/vothanhdat/react-state-custom/blob/master/bench/browser/results.json).
- After each run the page reads every consumer's value from the DOM. In the scenarios above every
  library must show what the others show; in the nested scenario every view must show its reference
  value. All runs passed.
- Headless Chrome 154, Apple M4 Pro, macOS; React 19.2.0, Zustand 5.0.15, Jotai 3.0.1.

### Scenarios (median ms per update)

| scenario | react-state-custom | zustand | jotai | React context |
|---|---|---|---|---|
| flat: update 1 key, 100 of 1000 consumers affected | 0.86 | 0.72 | 0.68 | 0.81 |
| flat: update 1 key, all 1000 consumers affected | 3.15 | 2.32 | 2.22 | 2.04 |
| derived: change one key (sum changes) | 3.29 | 3.90 | 2.19 | 3.21 |
| derived: move 1 between two keys (sum unchanged) | 0.055 | 0.59 | 0.010 | 1.41 |
| topology: one threshold (100 affected) | 0.92 | 0.68 | 0.68 | 0.82 |
| topology: all thresholds (1000 affected) | 3.34 | 2.22 | 2.34 | 2.10 |
| topology: unrelated root key (none affected) | 0.025 | 0.040 | 0.015 | 0.31 |
| shop: qty of one item (235 affected) | 1.51 | 0.94 | 0.94 | 1.16 |
| shop: vat (500 affected) | 2.08 | 1.59 | 1.70 | 1.49 |
| shop: theme (none affected) | 0.020 | 0.10 | 0.005 | 0.35 |
| shop: discount (1000 affected) | 4.20 | 2.92 | 2.79 | 2.41 |
| collection: one of 200 items, 5 of 1000 consumers affected | 0.52 | 0.54 | 0.47 | 0.71 |
| collection: same, array under one key | 1.58 | | | |

- **Updates that re-render consumers cost 1.1–1.6x Jotai, against 1.6–2.6x in jsdom.** Each sample now
  includes the style and layout of the changed elements, which is the same work in every library when
  the same consumers re-render, so the two commits of a store are a smaller share of it.
- **A derived value that changes costs less than in Zustand** (3.29 vs 3.90 ms), as in jsdom: one store
  run instead of a selector in each of the 1000 consumers.
- The other rows read as in jsdom: updates nothing reads cost almost nothing in the three subscription
  libraries, and the context baseline is fastest when all 1000 consumers re-render, except where each of
  them computes the derived value (derived sum).

### Nested state

The case of [Flatten a nested source](https://vothanhdat.github.io/react-state-custom/docs/guide/composing-stores#flatten-a-nested-source)
at stress size: 3 stores of 300 numeric fields, and 5000 views that each read 10 fields picked by a
fixed generator across the stores and render one weighted sum in an `<i>`. Four updates: one field;
ten fields spread over the three stores; one field while every view's output stays the same (views sum
`floor(value / 10000)`); one field no view reads. Seven ways to hold and read the fields:

- **flat root**: each store returns its fields as top-level keys; views read them through the proxy.
- **nested root**: each store returns `{ fields }`; views read `fields` through the proxy.
- **nested root, flattened by a store**: the nested stores, plus one store per root that returns
  `{ ...fields }`; views read its keys.
- **nested root, selectors** (react-state-custom and Zustand): one selector per view and store, summing
  the view's fields in that store.
- **jotai: nested root, derived field atoms**: a read-only atom per field derived from the root atom,
  and an atom per view summing its fields.
- **jotai: one atom per field**: a writable atom per field, no root object, and an atom per view.

Median ms per update:

| | one-field | ten-fields | output-unchanged | unread-field |
|---|---:|---:|---:|---:|
| react-state-custom: flat root | 2.79 | 8.73 | 0.71 | 0.065 |
| react-state-custom: nested root | 44.9 | 51.9 | 41.6 | 41.7 |
| react-state-custom: nested root, flattened by a store | 2.81 | 8.87 | 0.72 | 0.075 |
| react-state-custom: nested root, selectors | 5.96 | 16.9 | 3.01 | 2.53 |
| zustand: nested root, selectors | 5.43 | 14.5 | 2.29 | 2.31 |
| jotai: nested root, derived field atoms | 6.71 | 13.7 | 3.19 | 3.13 |
| jotai: one atom per field | 2.58 | 6.16 | 0.15 | 0.000 |

View renders per update:

| | one-field | ten-fields | output-unchanged | unread-field |
|---|---:|---:|---:|---:|
| react-state-custom: flat root | 48 | 531 | 48 | 0 |
| react-state-custom: nested root | 4920 | 5000 | 4920 | 4920 |
| react-state-custom: nested root, flattened by a store | 48 | 531 | 48 | 0 |
| react-state-custom: nested root, selectors | 48 | 531 | 0 | 0 |
| zustand: nested root, selectors | 48 | 531 | 0 | 0 |
| jotai: nested root, derived field atoms | 48 | 531 | 0 | 0 |
| jotai: one atom per field | 48 | 531 | 0 | 0 |

- **Fields under one key re-render every view of the store**: 4920 renders and 42–52 ms per update,
  whatever changed.
- **Flattening the nested store matches the flat root**: the same renders and the same time (2.81 vs
  2.79 ms for one field), for one extra store run per update.
- **Selectors render the same views, but run on every update**: about 5000 selector calls, 5.4–6.0 ms for
  one field. When the outputs stay the same they render nothing, where the flat stores re-render the 48
  readers of the changed field; with views this light, those renders (0.7 ms) still cost less than the
  selector calls (2.3–3.0 ms).
- **Jotai with one atom per field is the fastest in every case**: a view depends on its own 10 atoms,
  and a write touches only the atoms it changes.
- It is a stress workload: many views, picks with no relation to each other, and a view of one element.
  Heavier views are not measured here; they make each render cost more, which favours the approaches
  that render fewer views.
