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
- `useStoreSuspense` with an `isReady` predicate resolves immediately when the seed already satisfies it.

The hook's own first publish overwrites the seed key by key, so a key whose published value differs still triggers a re-render.

## `timeToClean`

How long an instance stays mounted after its last consumer unmounts, in milliseconds. Default `0`: the instance is torn down right away. A positive value keeps state and effects alive across quick unmount/remount sequences such as route changes or tab switches.

```ts
createStore('search', useSearchState, { timeToClean: 30_000 })
```

Retainers from `getStore().retain()` count as consumers.

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

The store hook receives a second argument: the values previously published by an instance with the same identity, or an empty object. It lets a store warm-start after a remount, for example when `timeToClean` expired but the context is still cached.

```ts
const useDraft = ({ id }: { id: string }, preState: Partial<{ text: string }>) => {
  const [text, setText] = useState(preState.text ?? '')
  return { text, setText }
}
```

Most stores ignore it.
