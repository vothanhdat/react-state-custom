# Store options

`createStore(name, useFn, options?)` takes an options object as its third argument.

```ts
createStore('name', useFn, {
  initialState: { ... },     // values consumers read before the hook has run
  timeToClean: 5000,         // keep the instance alive 5 s after its last consumer leaves (default 0)
  AttachedComponent: Logger, // optional component rendered next to each instance, receives params
})
```

A bare number is accepted as `timeToClean`: `createStore('name', useFn, 5000)`.

## `initialState`

Stores are lazy: nothing exists until the first consumer asks, and until the hook has run once its values read as `undefined`. Many stores are fine with that. The consumer renders once more on mount and reads with `??` or `?.`:

```ts
const { user } = useUserStore({ userId })   // User | undefined until the hook has run
return <span>{user?.name ?? '…'}</span>
```

Pass `initialState` when you want more than that: consumers get those values on the very first render, and the keys listed there are typed as always present on the `useStore` result.

```ts
export const { useStore: useUserStore } = createStore('user', useUserState, {
  initialState: { user: null, isLoading: true },
})

const { user, isLoading } = useUserStore({ userId }) // never undefined
```

`initialState` can also be a function of the params:

```ts
createStore('todos', useTodoState, {
  initialState: ({ listId }) => ({ listId, items: [] }),
})
```

It seeds the store's context once per instance, before the first consumer render. Three effects follow:

- On the server and during hydration, consumers render the seeded values, so server HTML shows a loading state instead of empty markup. See [Server-side rendering](/guide/ssr).
- A consumer whose first render reads only seeded keys renders once instead of twice when the hook's first publish matches the seed.
- `useStoreSuspense` with an `isReady` predicate resolves immediately when the seed already satisfies it. That render sees only the seeded keys; see [Suspense](/guide/suspense#behaviour).

The hook's own first publish overwrites the seed key by key, so a key whose published value differs still triggers a re-render.

## `timeToClean`

How long an instance stays mounted after its last consumer unmounts, in milliseconds. Default `0`: the instance is torn down right away. A positive value keeps state and effects alive across quick unmount/remount sequences such as route changes or tab switches.

```ts
createStore('search', useSearchState, { timeToClean: 30_000 })
```

Retainers from `getStore().retain()` count as consumers.

The instance keeps running during that time, effects included: a store that polls keeps polling, and a socket stays open. That is what you want when the next screen needs the live resource right away.

### Keeping the values, not the resource

To keep only the values once the screen closes, split the store: one store holds the values and has no effects, kept with a long `timeToClean`; another runs the resource with the default `timeToClean: 0` and writes into the first. Coming back shows the kept values at once while the resource reconnects.

```ts
// the values: no effects, kept for five minutes after the last reader leaves
export const { useStore: useRoomHistory } = createStore('room-history', ({ roomId }: { roomId: string }) => {
  const [messages, setMessages] = useState<Message[]>([])
  return { messages, setMessages }
}, { initialState: { messages: [] }, timeToClean: 5 * 60_000 })

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

## `AttachedComponent`

A component rendered next to each store instance, inside the same error boundary, receiving the store params as props. Use it for side effects that should run once per instance rather than once per consumer.

```tsx
const Analytics = ({ userId }: { userId: string }) => {
  useEffect(() => { track('user-store-mounted', userId) }, [userId])
  return null
}

createStore('user', useUserState, { AttachedComponent: Analytics })
```

Most of what `AttachedComponent` can do also fits inside the store hook itself as an effect. Reach for it when the side effect must not share a render with the hook, for example when it should keep running after the hook throws.

## The `preState` argument

The store hook receives a second argument: the values previously published by an instance with the same identity, or an empty object. It is read once, when the instance mounts, and stays the same object for the life of the instance. It lets a store pick up where the previous instance stopped when it remounts while its context is still alive: a hot update that restarts the hook, an [`<Activity>`](/guide/concurrent#hidden-content-with-activity) shown again, a remount right after a teardown. The context is dropped within a tenth of a second once nothing uses it, so `preState` does not carry values across a navigation; [keep the values in a store of their own](#keeping-the-values-not-the-resource) for that.

```ts
const useDraft = ({ id }: { id: string }, preState: Partial<{ text: string }>) => {
  const [text, setText] = useState(preState.text ?? '')
  return { text, setText }
}
```

Most stores ignore it.
