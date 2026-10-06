# Composing stores

A store hook can call other stores. Dependencies update automatically, because the inner `useStore` subscribes exactly like it would in a component.

```ts
const useSettingsState = () => {
  const [taxRate, setTaxRate] = useState(0.1)
  return { taxRate, setTaxRate }
}
export const { useStore: useSettingsStore } = createStore('settings', useSettingsState)

const useInvoiceState = ({ invoiceId }: { invoiceId: string }) => {
  const { taxRate = 0 } = useSettingsStore() // a store inside a store, undefined until settings has run
  const [subtotal, setSubtotal] = useState(0)
  return { subtotal, setSubtotal, total: subtotal * (1 + taxRate) }
}
export const { useStore: useInvoiceStore } = createStore('invoice', useInvoiceState)
```

When `taxRate` changes, the `invoice` store re-renders, recomputes `total` and publishes it. Consumers of `useInvoiceStore` that read `total` re-render; consumers that read only `subtotal` do not.

The inner store is mounted by the same `AutoRootCtx` and is torn down when the outer store, its last consumer, is torn down.

## Flatten a nested source

The proxy tracks top-level keys, so a component that reads `player` to show `player.score` re-renders when any field of `player` changes. When you write the hook, return the fields as keys: `return { ...player, setPlayer }` (see [Keeping the store small](/guide/selectors#keeping-the-store-small)). When the nested object is given, such as a socket payload, a query result or a store other code reads as one object, keep it and flatten it once in a store above:

```tsx
// the source keeps the object as it arrives
export const { useStore: usePlayerStore } = createStore('player', ({ id }: { id: string }) => {
  const [player, setPlayer] = useState(emptyPlayer)
  useEffect(() => subscribePlayer(id, setPlayer), [id]) // a new object on every message
  return { player }
})

// one shared store publishes its fields as top-level keys
export const { useStore: usePlayerFields } = createStore('player-fields', ({ id }: { id: string }) => {
  const { player } = usePlayerStore({ id })
  return { ...player }
})

function Score({ id }: { id: string }) {
  const { score } = usePlayerFields({ id }) // re-renders when score changes, not on every message
  return <b>{score}</b>
}
```

Each message re-runs `player-fields` once, and it publishes only the fields whose value changed, so a component re-renders only for the fields it reads. Every component with the same params shares that one instance. The Nested → Flat example of the [demo](https://vothanhdat.github.io/react-state-custom/) shows it next to the nested key and a selector per field.

- It is one level deep: `{ ...player }` publishes `address`, not `address.city`. Return `city: player.address.city` as its own key, or read it with a selector.
- An object field keeps its reference while the source keeps it, so it compares equal. A source that rebuilds nested objects on every message re-renders their readers.
- Read the fields from the flat store only. A component that reads both layers can see the new `player` next to the old fields for one render ([Layers are one commit apart](/guide/limitations#limitations)). Return what it needs from the flat store, actions included, under names no field uses: `return { ...player, follow }`.
- It adds one store and one commit per update. For a few readers, a selector each (`usePlayerStore({ id }, { select: s => s.player?.score })`) does the same without it; a selector runs in every reader on every message, the flat store once.

## Many instances at once

A store hook follows the rules of hooks, so it cannot call `useLineStore({ id })` once per item in a loop. Two shapes work.

**One instance per item, read with `useMultipleStore`.** When each item is a store of its own, a store above reads the list of them in one call, whatever its length:

```ts
const { storeRef: lineRef } = createStore('line', ({ id }: { id: string }) => {
  const item = useItems()[id]
  const { discount = 0 } = useSettingsStore()
  return { total: item ? lineTotal(item, discount) : 0 }
})

const useCheckoutState = ({ group }: { group: string }) => {
  const subtotal = useMultipleStore(groupIds(group).map(id => lineRef({ id })), {
    select: lines => lines.reduce((sum, line) => sum + (line.total ?? 0), 0),
  })
  const { vat = 0 } = useSettingsStore()
  return { total: subtotal * (1 + vat) }
}
```

Each line is its own instance, shared with any component that reads it, and the checkout re-renders only when its subtotal changes. See [`useMultipleStore`](/api/use-multiple-store). Every instance that re-runs is a component render and a publish, so for a derivation as cheap as a multiplication the next shape costs less; the shop scenario in [Benchmarks](/benchmarks) measures both.

**One store keyed by id.** When the items are cheap to compute together, let one store return an object keyed by id, and let the store above call that hook once and read the keys it needs.

```ts
// one store, one key per line
const useLinesState = () => {
  const items = useItems()                 // keyed by id, see Collections under Selectors
  const { discount } = useSettingsStore()
  return Object.fromEntries(itemIds.map(id => [id, items[id] ? lineTotal(items[id], discount ?? 0) : 0]))
}
export const { useStore: useLines } = createStore('lines', useLinesState)

// a checkout reads its lines with one hook call
const useCheckoutState = ({ group }: { group: string }) => {
  const lines = useLines()
  const { vat } = useSettingsStore()
  const subtotal = groupIds(group).reduce((sum, id) => sum + (lines[id] ?? 0), 0)
  return { total: subtotal * (1 + (vat ?? 0)) }
}
export const { useStore: useCheckoutStore } = createStore('checkout', useCheckoutState)
```

`lines` re-runs when any item it read changes and recomputes every line, but publishes only the keys whose value changed, so a checkout re-renders only when one of its own lines did. Granularity is per key at the output and per store at the computation. (`itemIds` and `groupIds` come from wherever the list is defined: a catalog, a route, or another key of the store such as `ids`.)

Every store in such a chain is one more React commit per update: `items` publishes, `lines` renders and publishes, `checkout` renders and publishes, then the components render. Deep graphs cost accordingly; the shop scenario in [Benchmarks](/benchmarks) measures a four-layer one. For the same reason, render from the last store of a chain rather than from several layers at once; [Progressive data](/guide/progressive-data) builds a screen that way from several fetched sources.

## Derived values in a plain hook

A derived value that only one component needs can stay in an ordinary hook instead of a store:

```ts
const useCartTotal = () => {
  const { items } = useCartStore()
  return (items ?? []).reduce((total, item) => total + item.price, 0)
}
```

This re-renders the calling component whenever `items` changes. To re-render only when the derived value changes, use a [selector](/guide/selectors):

```ts
const total = useCartStore(undefined, { select: s => (s.items ?? []).reduce((sum, i) => sum + i.price, 0) })
```

## Cycles

A cycle (store A reads store B, store B reads store A) is reported with a development warning. If the cycle also diverges, each store's update causing the other to update forever, React's nested-update limit stops it: the publishing store's hook throws "Maximum update depth exceeded", its [error boundary](/guide/error-handling) disables that store, and the error is logged. The rest of the app keeps running.
