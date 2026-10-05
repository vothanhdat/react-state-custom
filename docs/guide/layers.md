# Organizing stores in layers

In a small app every store reads the network and every component reads every store. As the app grows, stores fall into kinds: those that own data and IO, and those that shape it for a screen. Keep them in layers, with imports going one way only:

```
domain        plain functions and types: rules, arithmetic, formatting. No React, no stores
stores/core   stores that own IO and data: fetches, sockets, caches, the session. Nothing about the UI
stores/ui     view-models: what the screens render, built from core stores
components    views: read stores/ui only, plus their own local state
```

`demos/trading` in the repository is built this way: an order book, an account, an order ticket and a dozen panels over a simulated exchange.

## Domain

Pure functions over plain data: book arithmetic, order validation, valuation. They need no React and no store to test, and both store layers call them. A rule that a store computes inline, such as "a sell order needs that much free balance", moves here as soon as a second place needs it.

## Core stores

A core store owns one source: it subscribes, fetches, reconnects, keeps the data and exposes commands.

- **Commands return outcomes.** `placeOrder(draft)` resolves with `{ ok: true, order }` or `{ ok: false, error }`. Showing a toast or a field error is the caller's choice.
- **Events go to listeners.** Something that happens once, such as a fill, goes out through `onFill(listener)` rather than a `lastFill` key. See [Events from a store](/guide/events).
- **Nothing about the UI.** No toasts, no navigation, no formatting, no imports from `stores/ui` or components. A core store that called the toast store tied the account to the UI and to whether the toast store was running yet (see [Before the data arrives](/guide/getting-started#before-the-data-arrives)).
- **Lifetimes follow the data.** Reference data that every screen shares keeps a long `timeToClean`; a stream per symbol keeps a short one, so flipping between two symbols does not resubscribe.
- **Publish at the rate the screen changes.** A store fed by a socket publishes once per frame (see [Realtime data](/guide/realtime)).

## UI layer

The UI layer turns core data into what a screen renders: rows, labels, enabled buttons, validation messages. It also decides presentation: which failures become toasts, and how often each view follows the data ([Update cadence](/guide/update-cadence)).

**A store, or a hook?** Each store adds a commit to every update that reaches it. Make a UI piece a store when it:

- holds state of its own: a draft order, a selection, the list of toasts;
- is read by several components, so it computes once for all of them;
- must exist once whoever starts it, such as a listener that turns fills into toasts.

Otherwise make it a plain hook over the core stores. It runs inside the component that calls it and costs no commit.

```ts
// stores/ui/marketViews.ts: one reader, so a hook
export const useDepth = (symbol: string, zoom: number) => {
  const { bids, asks, mid } = useBook({ symbol }, { schedule: { throttle: 100 } })
  return useMemo(() => depthView(bids, asks, mid, zoom), [bids, asks, mid, zoom])
}

// stores/ui/orderForm.ts: holds the draft and several panels fill it, so a store
export const { useStore: useOrderForm } = createStore('order-form', useOrderFormState, { timeToClean: 10 * 60_000 })
```

## Views

Components read only the UI layer, plus their own local state. A view never learns where data comes from, so a change of transport or of a core store's shape stops at the UI layer.

## Enforce it with a test

A layering rule nobody checks erodes. Scan the imports and fail on the ones that go up:

```ts
// tests/architecture.test.ts
// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'

const src = path.resolve(__dirname, '../src')
type Layer = 'domain' | 'core' | 'ui' | 'view'
const layerOf = (file: string): Layer => {
  const rel = path.relative(src, file).split(path.sep).join('/')
  return rel.startsWith('domain/') ? 'domain' : rel.startsWith('stores/core/') ? 'core' : rel.startsWith('stores/ui/') ? 'ui' : 'view'
}
const allowed: Record<Layer, Layer[]> = {
  domain: ['domain'],
  core: ['core', 'domain'],
  ui: ['ui', 'core', 'domain'],
  view: ['view', 'ui', 'domain'],
}
const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [])
const importsOf = (file: string) =>
  [...fs.readFileSync(file, 'utf8').matchAll(/^(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+?\s+from\s+)?['"](\.[^'"]+)['"]/gm)].map(m => m[1]!)

it('imports only go down the layers', () => {
  const violations = files(src).flatMap(file => importsOf(file)
    .map(spec => [layerOf(file), layerOf(path.resolve(path.dirname(file), spec)), spec] as const)
    .filter(([from, to]) => !allowed[from].includes(to))
    .map(([from, to, spec]) => `${path.relative(src, file)} (${from}) imports ${spec} (${to})`))
  expect(violations).toEqual([])
})
```

The demo's version also limits which packages each layer may import: only the store layers import `react-state-custom`, and components never import a store from `stores/core`.

## Test one layer at a time

- **Domain**: plain unit tests.
- **Core**: fake the transport with `vi.mock` of the client module, start the store with `storeHandle(useX).retain()` and wait with `waitForStore`. The test decides when each response and each message arrives, so it can reproduce a race: an event that arrives while the snapshot request is in flight, a stream message that beats the REST response. See [Testing](/guide/testing#fake-the-transport).
- **UI**: `mockStore` the core stores it reads and check what it computes.
- **Views**: `mockStore` the UI stores, or render them over mocked core stores.

## What it costs

A UI piece that is a hook costs nothing: it runs in its component. A UI store adds one commit per update of what it reads, the same as any [composed store](/guide/composing-stores). In the trading demo, moving from mixed stores to these layers changed nothing measurable: at 20× feed speed, script time per second was 121, 137 and 122 ms before and 128, 132 and 130 ms after (headless Chrome, production build, alternating runs).
