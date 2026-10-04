# Selectors

Pass a selector as the second argument of `useStore` to re-render only when a derived or deep value changes.

```ts
const name = useUserStore({ userId }, s => s.user?.name)
const total = useCartStore(undefined, s => s.items.reduce((sum, i) => sum + i.price, 0))
const tags = usePostStore({ id }, s => s.post?.tags ?? [], shallowEqual)
```

- The selector receives the **plain state object** (`initialState` merged with the live data), not the tracking proxy, so it can read as deep as it likes and compute anything.
- The result is compared with `Object.is` after every publish. Pass your own `isEqual` as the third argument when the selector returns a fresh array or object each time.
- A new selector function on every render is fine; it is not used as a dependency.
- For stores without params pass `undefined` as the first argument.

## Proxy or selector?

The proxy returned by `useStore(params)` tracks **top-level keys**. Reading `user` subscribes to the whole `user` object: a change to `user.email` re-renders a component that only displayed `user.name`.

| Need | Use |
|---|---|
| A few top-level keys | `const { a, b } = useStore(params)` |
| One deep value | `useStore(params, s => s.user?.name)` |
| A derived value | `useStore(params, s => s.items.length)` |
| Several deep values | `useStore(params, s => ({ ... }), shallowEqual)` or several selector calls |
| Many components reading different fields of one nested object | Return the fields as top-level keys, or [flatten it in a shared store](/guide/composing-stores#flatten-a-nested-source) |
| A derived value many components read | Compute it in a store and return it as a key: it runs once per change, a selector once per reader ([Composing stores](/guide/composing-stores)) |
| A list of items that change independently | An object keyed by id ([Collections](#collections-keys-not-arrays)) |
| A resource per id, with its own effects | A [parameterized store](/guide/parameterized-stores) |

Both can be combined in one component. Each call is an independent subscription. Flattening is one level deep: a key that holds an object re-renders all its readers when it changes.

## Keeping the store small

Selectors are cheap, but a store that publishes one large object forces every selector to run on every change to that object. Where it is natural, return several keys from the hook instead of one nested object, so the proxy's key tracking can do the filtering.

```ts
// one key: every consumer runs its selector on each change
return { profile: { name, email, avatar, settings } }

// several keys: consumers subscribe only to what they read
return { name, email, avatar, settings }
```

When the nested object comes from elsewhere, flatten it in a store above: see [Flatten a nested source](/guide/composing-stores#flatten-a-nested-source).

## Collections: keys, not arrays

The same rule applies to a list of items that change independently. An array under one key is one key: when any item changes, every component reading from that array re-renders, whatever item it shows.

```ts
// one key: every reader of any item re-renders when one item changes
const useListState = () => {
  const [items, setItems] = useState<Item[]>([])
  return { items, setItem: (i: number, item: Item) => setItems(s => s.map((x, j) => j === i ? item : x)) }
}
```

Return an object keyed by id instead. Each id is a top-level key, so a reader of `items[id]` subscribes to that id alone, and the store publishes only the keys whose value changed (`Object.is`). Reading one key through the proxy is a property access; no selector runs.

```ts
// one key per item: only the readers of the changed item re-render
const useItemsState = () => {
  const [items, setItems] = useState<Record<string, Item>>({})
  const setItem = (id: string, item: Item) => setItems(s => ({ ...s, [id]: item }))
  return { ...items, setItem } as Record<string, Item> & { setItem: typeof setItem }
}
export const { useStore: useItems } = createStore('items', useItemsState)

const price = useItems()[id]?.price

// the list of ids re-renders only when an item is added or removed
const ids = Object.keys(useItems()).filter(id => id !== 'setItem')
```

(The cast is there because TypeScript drops the index signature when an object with one is spread next to a named property.)

When each item has its own lifecycle, a fetch or a subscription, make it a [parameterized store](/guide/parameterized-stores) instead: `useItem({ id })` is one instance per id, mounted while someone reads it. The collection scenario in [Benchmarks](/benchmarks) measures the array and the keyed shapes side by side: 1000 renders against 5 for one changed item.

## Under the hood

Selectors are implemented by `useDataSelector(ctx, selector, isEqual?)`, exported for use with raw contexts. See [Primitives](/api/primitives).
