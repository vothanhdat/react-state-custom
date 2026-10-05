# Realtime data

Stores fed by a socket: snapshots and deltas, sequence gaps, reconnects, bursts of messages, history that races the live stream. The snippets come from `demos/trading` in the repository, a trading terminal over a simulated exchange, shortened.

## Snapshot and sequenced deltas

An order book arrives as a snapshot, then deltas numbered in sequence. Keep the working copy in plain maps inside the effect, mutate them per message, and turn them into state once per frame:

```ts
const useBookState = ({ symbol }: { symbol: string }) => {
  const [book, setBook] = useState<{ bids: Level[]; asks: Level[] }>()
  const [status, setStatus] = useState<'loading' | 'live' | 'resyncing'>('loading')
  // bumped when a delta is missing: the effect subscribes again and gets a fresh snapshot
  const [epoch, setEpoch] = useState(0)

  useEffect(() => {
    const bids = new Map<number, number>()
    const asks = new Map<number, number>()
    let seq: number | undefined
    let broken = false
    const publish = scheduled(() => setBook({ bids: sortLevels(bids, true), asks: sortLevels(asks, false) }), frame())

    const unsubscribe = socket.subscribe('book', symbol, msg => {
      if (broken) return
      if (msg.type === 'snapshot') {
        bids.clear(); asks.clear()
        applyLevels(bids, msg.bids); applyLevels(asks, msg.asks)
        seq = msg.seq
        setStatus('live')
      } else {
        if (seq === undefined) return                // deltas before the snapshot
        if (msg.prevSeq !== seq) {                   // a gap: this copy is wrong from here on
          broken = true
          setStatus('resyncing')
          setEpoch(e => e + 1)
          return
        }
        applyLevels(bids, msg.bids); applyLevels(asks, msg.asks)
        seq = msg.seq
      }
      publish()
    })
    return () => {
      unsubscribe()
      publish.cancel()
    }
  }, [symbol, epoch])

  return { bids: book?.bids, asks: book?.asks, status }
}

export const { useStore: useBook } = createStore('book', useBookState, { timeToClean: 2000 })
```

- **A gap starts over.** The effect cannot repair a copy that missed a delta. Bumping `epoch` re-runs it: the cleanup unsubscribes, the new run subscribes and receives a new snapshot. Readers keep the last book, marked `resyncing`, meanwhile.
- **Messages before the snapshot are dropped** here, because the snapshot contains them. When the snapshot comes from a separate request instead, buffer them (see [Snapshot by request](#snapshot-by-request)).
- **Plain maps, published per frame.** A store that set state per message would render and publish per message. `scheduled(publish, frame())` turns any number of messages into one store render per frame. For a value that is replaced or merged per message, [`useFrameState`](/api/schedulers#useframestate-initial) does the same with less code.
- **`timeToClean`** keeps the subscription for two seconds after the last reader leaves, so flipping between two symbols does not resubscribe each time.

## Reconnects

A connection store publishes whether the socket is up. Stores whose data cannot survive a drop list it in their effect's dependencies:

```ts
export const { useStore: useConnection } = createStore('connection', () => {
  const [status, setStatus] = useState<ConnectionStatus>(socket.status)
  useEffect(() => socket.onStatus(setStatus), [])
  return { status, online: status === 'open' }
})

// in a store that must refetch after a drop
const { online } = useConnection()
useEffect(() => {
  if (!online) return
  // subscribe, fetch the history, ...
}, [symbol, online])
```

While offline, keep the last data and say it is stale (`status: online ? status : 'stale'`) rather than clearing it.

## History and the live stream

Candles come from a request; new trades come from the socket. The request may answer before or after trades that it already counts. Subscribe first and buffer, then merge only the trades newer than the history's last trade id:

```ts
useEffect(() => {
  if (!online) return
  let cancelled = false
  let pending: Trade[] = []
  let lastTradeId: number | undefined         // undefined until the history has arrived

  const publish = scheduled(() => {
    const trades = pending
    pending = []
    setCandles(prev => (prev ? mergeTrades(prev, trades, interval) : prev))
  }, frame())
  const unsubscribe = socket.subscribe('trades', symbol, batch => {
    pending.push(...batch)
    if (lastTradeId !== undefined) publish()
  })

  api.getCandles(symbol, interval).then(res => {
    if (cancelled) return
    lastTradeId = res.lastTradeId
    setCandles(mergeTrades(res.candles, pending.filter(t => t.id > res.lastTradeId), interval))
    pending = []
  })
  return () => {
    cancelled = true
    unsubscribe()
    publish.cancel()
  }
}, [symbol, interval, online])
```

Merging by id makes the order of arrival irrelevant: a trade counted by the history is skipped, a newer one is added once.

## Snapshot by request

An account is a snapshot from a request plus a stream of numbered events. Events that arrive while the request is in flight are buffered; once the snapshot is there, those it already contains (`seq <= snapshot.seq`) are skipped and the rest applied in order. A gap anywhere refetches. A response to a command (an order placed) and the event for the same change can arrive in either order: keep a version on each record and keep the newer copy.

## Readers

Core stores publish once per frame at most. Views that need less, such as a chart or a log, set their own cadence. See [Update cadence](/guide/update-cadence).

## Testing

Replace the socket and API module with a fake whose messages and responses the test sends, so it can reproduce each race:

```ts
const fake = vi.hoisted(() => {
  const handlers = new Set<(msg: unknown) => void>()
  return {
    emit: (msg: unknown) => handlers.forEach(h => h(msg)),
    handlers,
    api: { getAccount: vi.fn() },
  }
})
vi.mock('../src/sim/exchange', () => ({
  api: fake.api,
  socket: {
    subscribe: (_channel: string, _key: string, handler: (msg: unknown) => void) => {
      fake.handlers.add(handler)
      return () => fake.handlers.delete(handler)
    },
  },
}))
```

See [Testing](/guide/testing#fake-the-transport) for a full test.
