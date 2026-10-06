# For React developers

If you write custom hooks, you already know how to write a store. This page maps what you know onto the library, compares it with the state libraries you may be using, and says what it costs. The [Rules](/guide/rules) are what to remember.

## The model

A store is a custom hook that runs once per params instead of once per caller. `createStore('cart', useCartState)` registers the hook. The first component that calls the returned `useStore({ userId })` makes `<AutoRootCtx />` mount a small component that runs `useCartState({ userId })` and publishes what it returns, key by key. Every caller with the same params reads that one instance, through a proxy that subscribes it to the keys it read during render. After the last reader leaves, the instance unmounts and its effects clean up. A store hook can call other stores, so derived state is a store that reads another. [How it works](/guide/how-it-works) has the render flow.

## What you know, here

| In plain React | With a store |
|---|---|
| A custom hook: one state per caller | One state per params, shared by every caller |
| Lifting state up to share it | Calling the same store in both places |
| A context and its provider | One `AutoRootCtx` for every store, no provider per store |
| A context change re-renders every consumer | A reader re-renders only for the keys it read |
| `useMemo` over shared data in each consumer | A store that computes it once, or `select` in the reader |
| A fetch in `useEffect`, once per component | The fetch in the store: once per params, cancelled by its cleanup |
| Cleanup when the component unmounts | Cleanup when the last reader leaves, or `timeToClean` later |

## Compared with state libraries

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
| **Cost per update** | when consumers re-render, 1.3–2.1x Jotai's in jsdom and 1.1–1.3x in Chrome; one more commit per derived layer | lower whenever consumers re-render, in our jsdom and Chrome [benchmarks](/benchmarks) |
| **Ecosystem** | every React hook works inside a store | a large set of atom utilities |
| **To learn** | React hooks, plus [its own rules](/guide/rules): lazy start, one instance per params, tracked reads, one commit per layer | the atom model |

Jotai's update path costs less: it updates atoms outside React and renders the consumers in one commit. If your state is a graph of things that fetch, subscribe and derive, such as `config → market data → order book → positions → summary`, write each node as a hook, keep the graph acyclic, and import the hook where it is needed.

**RTK Query** is the closest for server data: one cache entry per endpoint argument, reference-counted while components use it, kept for `keepUnusedDataFor` after the last one leaves (`timeToClean` here), and fed by a socket through `onCacheEntryAdded`. It adds Redux, cache invalidation and its devtools; the entry holds what the endpoint returns, and derived values go through selectors. Here a store is any hook, so server data, values derived from it and UI state such as a draft order are written the same way.

**Zustand** is the least code for a flat global bag of values, with no per-key instances or lifecycle: you write the ref-counting around sockets yourself. **Redux** is a different model (actions and reducers) aimed at a different scale of ceremony. A plain **React context** re-renders every consumer on every change.

## Structuring an app

As the app grows, keep stores in layers, with imports going down only:

```
domain        plain functions and types: rules, arithmetic, formatting
stores/core   stores that own IO and data: fetches, sockets, the session
stores/ui     view-models: what the screens render, built from core stores
components    views: read stores/ui, plus their own state
```

It is the split between container and presentational components, applied to state. Core stores own the data and know nothing about the UI; the UI layer decides what a screen shows and how often; views only render. A UI piece is a store when it holds state of its own, several components read it, or it must run once (a listener that turns events into toasts); otherwise it is a plain hook, which costs no commit. [Organizing stores in layers](/guide/layers) has the rules for each layer and a test that enforces the import direction.

## What it costs

- **Two commits per update.** The store renders and publishes, then the readers of a changed key render; each store in a chain adds one. The table above has what that costs against Jotai.
- **Nothing before the first run.** A store starts when its first reader mounts, so that reader renders once with every key `undefined`.
- **Store hooks see the providers above `AutoRootCtx`**, not the ones around the reader.
- **Client only.** On the server `useStore` returns `{}` and no store runs ([Server-side rendering](/guide/ssr)).

[Limitations and FAQ](/guide/limitations) has the full list.
