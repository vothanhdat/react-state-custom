# Selectors

Pass a selector as the second argument of `useStore` to re-render only when a derived or deep value changes.

```ts
const name = useUserStore({ userId }, s => s.user?.name)
const total = useCartStore(s => s.items.reduce((sum, i) => sum + i.price, 0))   // a store without params
const tags = usePostStore({ id }, s => s.post?.tags ?? [], shallowEqual)
```

- The selector receives the **plain state object** (`initialState` merged with the live data), not the tracking proxy, so it can read as deep as it likes and compute anything.
- The result is compared with `Object.is` after every publish. Pass an `isEqual` as the third argument when the selector returns a fresh array or object each time: [`shallowEqual`](/api/primitives#shallowequal), exported by the library, compares arrays and plain objects one level deep.
- The third argument can also be an object: `{ isEqual, schedule }`, where [`schedule`](/guide/update-cadence) says how often the component follows the store.
- A new selector function on every render is fine; it is not used as a dependency.
- For a store without params the selector comes first: `useCartStore(s => s.total)`, the same as `useCartStore(undefined, s => s.total)`.

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

The collection scenario in [Benchmarks](/benchmarks) measures the array and the keyed shapes side by side: 1000 renders against 5 for one changed item.

### Rendering a list

Pass each row its id, not its item, and let the row read its own item with a selector:

```tsx
const TaskRow = memo(({ projectId, id }: { projectId: string; id: string }) => {
  const task = useTasks({ projectId }, s => s.tasks?.[id])
  if (!task) return null                 // deleted while the list still had its id
  return <li>{task.title}</li>
})

const TaskList = ({ projectId }: { projectId: string }) => {
  const ids = useVisible({ projectId }, s => s.ids ?? [], shallowEqual)
  return <ul>{ids.map(id => <TaskRow key={id} projectId={projectId} id={id} />)}</ul>
}
```

- A change to one task re-renders its row only. The row's selector picks its own task; `memo` skips the other rows when the list re-renders, since their props are the same strings; and [`shallowEqual`](/api/primitives#shallowequal) keeps the list from re-rendering when a store computes a new `ids` array holding the same ids.
- The row checks for a missing task. The ids come from `visible`, a store derived from `tasks` that publishes one commit later: when a task is deleted, its row renders once more before the list drops it. See [Data across stores](/guide/how-it-works#data-across-stores).
- For a short list, the list can read the items from the store that holds them and pass each row its item, with `memo` on the row. A store that replaces only the changed item keeps the other items' identity, and the list and its rows always see the same data.

### Items with their own fetch or subscription

Two shapes work:

- **A store per id.** `createStore('task-detail', ({ taskId }) => ...)` is one instance per id, mounted while someone reads it ([Parameterized stores](/guide/parameterized-stores)). The library counts its readers, keeps it for `timeToClean` after the last one leaves, and confines a failure to that item. This is the least code. Another store cannot call it once per id in a loop; see [Many instances at once](/guide/composing-stores#many-instances-at-once).
- **One store for the whole collection**: a record per id for the data and one for its status, and a `subscribe(id)` action that starts loading the first time an id is asked for. You count readers and drop entries yourself. In exchange one store can batch the requests of many ids into one, apply one policy (how many requests at a time, prefetching, how many entries to keep) and share one socket, and a store that combines many items reads them with one call.

```ts
type Entry = { readers: number; drop?: ReturnType<typeof setTimeout>; stop: () => void }

export const { useStore: useTaskDetails } = createStore('task-details', () => {
  const [details, setDetails] = useState<Record<string, Detail | undefined>>({})
  const [status, setStatus] = useState<Record<string, 'loading' | 'loaded' | 'error' | undefined>>({})
  const entries = useRef(new Map<string, Entry>())   // bookkeeping, never rendered: keep it out of state

  // updater functions throughout: these callbacks run later, holding an old render's state
  const start = (id: string): Entry => {
    setStatus(s => ({ ...s, [id]: 'loading' }))
    api.fetchDetail(id).then(
      d => { setDetails(s => ({ ...s, [id]: d })); setStatus(s => ({ ...s, [id]: 'loaded' })) },
      () => setStatus(s => ({ ...s, [id]: 'error' })),
    )
    const entry: Entry = { readers: 0, stop: socket.watchTask(id, d => setDetails(s => ({ ...s, [id]: d }))) }
    entries.current.set(id, entry)
    return entry
  }

  const subscribe = (id: string) => {
    const entry = entries.current.get(id) ?? start(id)
    clearTimeout(entry.drop)
    entry.readers++
    return () => {
      if (--entry.readers > 0) return
      // wait before dropping: StrictMode runs effects twice, and a reader may come right back
      entry.drop = setTimeout(() => { entry.stop(); entries.current.delete(id) }, 5_000)
    }
  }

  // the store is torn down: run the drops still waiting. Entries with readers stay, since
  // StrictMode and Fast Refresh also run this cleanup while the store keeps running
  useEffect(() => () => {
    entries.current.forEach((entry, id) => {
      if (entry.readers > 0) return
      clearTimeout(entry.drop)
      entry.stop()
      entries.current.delete(id)
    })
  }, [])

  return { details, status, subscribe }
}, { timeToClean: 60_000 })   // outlives its last reader, so the grace period can run

export const useTaskDetail = (id: string) => {
  const { subscribe } = useTaskDetails()
  useEffect(() => subscribe?.(id), [subscribe, id])   // runs again once `subscribe` exists
  const detail = useTaskDetails(s => s.details?.[id])
  const status = useTaskDetails(s => s.status?.[id])
  return { detail, status }
}
```

- `subscribe` is `undefined` until the store has run: the effect does nothing then and runs again once it exists. The effect does nothing else, so running again costs nothing. A restarted instance has a new `subscribe`, and the effect subscribes to it.
- The store needs a `timeToClean` longer than the grace period. Its readers are its only consumers: without it, the store is torn down with its last reader, entries and all, and a reader that comes back starts over.
- Readers select their own id, so a change to one entry re-renders that entry's readers only. Every reader's selector still runs on every change; with thousands of entries changing many times a second, publish each id as its own top-level key (above) instead.
- A dropped id keeps its data in `details` as a cache until the store is torn down. Delete it in the drop timer to free it.
- A store that combines entries, such as a comment count over the selected tasks, reads `useTaskDetails()` once and checks each entry, since some are still loading.

## Under the hood

Selectors are implemented by `useDataSelector(ctx, selector, isEqual?)`, exported for use with raw contexts. See [Primitives](/api/primitives).
