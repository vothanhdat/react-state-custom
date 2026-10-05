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

## Deprecated options

These keep working in 1.x and are removed in 2.0. See [Migrating to 2.0](/guide/migrating-to-2).

### `initialState`

Values readers got before the hook had run, typed as always present: `initialState: { user: null, isLoading: true }`, or a function of the params. It also gave the server HTML a loading state.

Instead, default at the read: `const { isLoading = true, user } = useUserStore({ userId })`, or `user?.name ?? '…'`. On the server `useStore` returns `{}`, so the server renders the same loading state the first client render shows.

### `AttachedComponent`

A component rendered next to each instance with the params as props, for side effects once per instance. Instead, write the effect in the store hook: it runs once per instance too.

```ts
const useUserState = ({ userId }: { userId: string }) => {
  useEffect(() => { track('user-store-mounted', userId) }, [userId])
  // ...
}
```

### A number, or a fourth argument

`createStore('name', useFn, 5000)` meant `{ timeToClean: 5000 }`, and a fourth argument was the `AttachedComponent`. Pass an options object.

### The `preState` argument

The store hook received a second argument: the values previously published by an instance with the same identity while something still held its context (a hot update that restarted the hook, an `<Activity>` shown again). Instead, keep the instance with `timeToClean`, or [keep the values in a store of their own](#keeping-the-values-not-the-resource). From 2.0, a hot update that changes the hook's hooks restarts it from its initial state, as Fast Refresh does with a component.
