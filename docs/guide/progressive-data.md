# Progressive data

Screens are often built from several server sources: a price, an order book, the user's positions. Each arrives on its own schedule. With one store per source and one store that combines them, the screen shows each piece as soon as it arrives, and the view stays free of loading logic.

## One store per source

A source store is a hook that fetches. Its params pick the instance, its effect does the work, and its cleanup cancels it.

```ts
const useFetch = <T,>(url: string) => {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>()
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch(url, { signal: controller.signal })
      .then(res => res.json())
      .then(setData, e => { if (!controller.signal.aborted) setError(e) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [url])
  return { data, loading, error }
}

export const { useStore: useTicker } = createStore('ticker',
  ({ symbol }: { symbol: string }) => useFetch<Ticker>(`/api/ticker/${symbol}`))

export const { useStore: usePositions } = createStore('positions',
  () => useFetch<Record<string, Position>>('/api/me/positions'))

export const { useStore: useBook } = createStore('book', ({ symbol }: { symbol: string }) => {
  const [book, setBook] = useState<Book>()
  useEffect(() => socket.subscribe(`book:${symbol}`, setBook), [symbol])
  return { bids: book?.bids, asks: book?.asks }
})
```

Every component and store that asks for `useTicker({ symbol: 'BTC' })` shares one instance and one request.

## Combine in a store, render from it

The combining store reads the sources and derives what the screen shows. Each value is computed from whatever has arrived and stays `undefined` until its inputs are there.

```ts
export const { useStore: useSymbolView } = createStore('symbol-view', ({ symbol }: { symbol: string }) => {
  const { data: ticker } = useTicker({ symbol })
  const { bids, asks } = useBook({ symbol })
  const { data: positions } = usePositions()
  const position = positions?.[symbol]
  return {
    price: ticker?.price,
    spread: bids?.[0] && asks?.[0] ? asks[0].price - bids[0].price : undefined,
    pnl: ticker && position ? (ticker.price - position.entry) * position.qty : undefined,
  }
})

const SymbolHeader = ({ symbol }: { symbol: string }) => {
  const { price, spread, pnl } = useSymbolView({ symbol })
  return <header>{price ?? '…'} · {spread ?? '…'} · {pnl ?? '…'}</header>
}
```

The price shows when the ticker responds, the spread when the first book snapshot arrives, the P&L when both the ticker and the positions are in. No component waits for all three, and the view contains no fetching or combining logic.

Keep the view reading from the combining store only. Each store publishes one commit after the stores it reads, so a component that read `useTicker` and `useSymbolView` side by side could, for one render, see a new price next to a P&L computed from the old one. Values published by the same store always arrive together. If the view needs a raw value too, re-export it from the combining store.

## What the values mean

A store is lazy: until its hook has run once, every key is `undefined`. A `loading` flag therefore goes `undefined` → `true` → `false`, where `undefined` means not started yet. Treat it as loading:

```ts
const { loading = true } = useTicker({ symbol })
```

Pass [`initialState`](/guide/store-options#initialstate) instead, such as `{ loading: true }`, when you want the key typed as always present.

## Switching params

When `symbol` changes from `BTC` to `ETH`, the component reads the `ETH` instance right away:

1. It renders with `ETH`'s values, all `undefined`: never `BTC`'s data under the `ETH` label.
2. `AutoRootCtx` mounts the `ETH` instances, their effects start fetching and they publish `loading: true`.
3. The `BTC` instances lose their last consumer and are torn down; their cleanups abort the requests.
4. `ETH`'s responses publish as they arrive.

Each params value has its own `useState`, so a slow `BTC` response can only land in the `BTC` instance. There is no request id to compare and no race to guard against.

## Keeping data around

By default an instance is torn down as soon as its last consumer leaves, so switching back to `BTC` fetches again. A [`timeToClean`](/guide/store-options#timetoclean) keeps it mounted for that long, which makes it a cache: switching back shows the data at once, and the effect does not run again because the instance never unmounted.

```ts
createStore('ticker', useTickerState, { timeToClean: 60_000 })
```

Refreshing belongs in the store, written like any hook: an interval, a `visibilitychange` listener, a socket. The store keeps showing its last `data` while it refetches.

```ts
const useTickerState = ({ symbol }: { symbol: string }) => {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])
  return useFetch<Ticker>(`/api/ticker/${symbol}?t=${tick}`)
}
```

In development, StrictMode runs every effect twice, so each request starts, aborts and starts again, exactly as it would in a component.

## With a data-fetching library

For caching across the whole app, retries and invalidation, let a library such as TanStack Query fetch, and use stores to combine. `useQuery` works inside a store hook like any hook:

```ts
export const { useStore: useTicker } = createStore('ticker', ({ symbol }: { symbol: string }) => {
  const { data, isPending } = useQuery({ queryKey: ['ticker', symbol], queryFn: () => fetchTicker(symbol) })
  return { data, loading: isPending }
})
```

Store hooks run inside `AutoRootCtx`, so they see the context providers above `AutoRootCtx`, not those around the component that calls `useStore`. Put `QueryClientProvider` (and any router, theme or i18n provider a store needs) outside it:

```tsx
<QueryClientProvider client={queryClient}>
  <AutoRootCtx />
  <App />
</QueryClientProvider>
```
