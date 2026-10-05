# Store options

`createStore(name, useFn, options?)` takes an options object as its third argument.

```ts
createStore('name', useFn, {
  timeToClean: 5000, // keep the instance alive 5 s after its last reader leaves (default 0)
  schedule: frame(), // when readers re-render for a change (default: at once)
})
```

Stores are lazy: nothing exists until the first reader asks, and until the hook has run once its values read as `undefined`. Readers default at the read with `??` or `?.`; see [Before the data arrives](/guide/getting-started#before-the-data-arrives).

## `timeToClean`

How long an instance stays mounted after its last consumer unmounts, in milliseconds. Default `0`: the instance is torn down right away. A positive value keeps state and effects alive across quick unmount/remount sequences such as route changes or tab switches.

```ts
createStore('search', useSearchState, { timeToClean: 30_000 })
```

Retainers from `storeRef(params).retain()` count as readers.

`Infinity` keeps the instance until `AutoRootCtx` unmounts: for a store the whole app shares, such as the session or a socket connection. Any value of 2³¹ − 1 ms (about 24.8 days) or more does the same. Earlier versions tore such an instance down at once, because a timer that long fires immediately.

The instance keeps running during that time, effects included: a store that polls keeps polling, and a socket stays open. That is what you want when the next screen needs the live resource right away.

### Keeping the values, not the resource

To keep only the values once the screen closes, split the store: one store holds the values and has no effects, kept with a long `timeToClean`; another runs the resource with the default `timeToClean: 0` and writes into the first. Coming back shows the kept values at once while the resource reconnects.

```ts
// the values: no effects, kept for five minutes after the last reader leaves
export const { useStore: useRoomHistory } = createStore('room-history', ({ roomId }: { roomId: string }) => {
  const [messages, setMessages] = useState<Message[]>([])
  return { messages, setMessages }
}, { timeToClean: 5 * 60_000 })

// the resource: the socket closes as soon as the last screen leaves
export const { useStore: useRoom } = createStore('room', ({ roomId }: { roomId: string }) => {
  const { messages, setMessages } = useRoomHistory({ roomId })
  useEffect(() => {
    if (!setMessages) return
    return socket.subscribe(roomId, message => setMessages(list => [...list, message]))
  }, [roomId, setMessages])
  return { messages }
})
```

The Live Rooms example of the [demo](https://vothanhdat.github.io/react-state-custom/) runs this split. Server data fetched through a query library can stay in that library's cache instead: a store mounted again starts from the cached response while it refetches.

## `schedule`

When the store's readers re-render for a change: a [scheduler](/api/schedulers) such as `frame()`, `throttle(ms)`, `debounce(ms, { maxWait })` or `idle(ms)`, imported from `react-state-custom/schedulers` (default: at once). A reader can pass its own: `useStore(params, { schedule })`. The store itself, `storeRef(params).get()` and actions are never delayed. See [Update cadence](/guide/update-cadence).

```ts
// equity moves with every price tick: its readers show it four times a second
createStore('portfolio', usePortfolioState, { schedule: throttle(250) })
```

## Side effects once per instance

A store hook runs once per instance, so an effect in it runs once per instance too, however many components read the store:

```ts
const useUserState = ({ userId }: { userId: string }) => {
  useEffect(() => { track('user-store-mounted', userId) }, [userId])
  // ...
}
```
