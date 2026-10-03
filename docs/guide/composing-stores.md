# Composing stores

A store hook can call other stores. Dependencies update automatically, because the inner `useStore` subscribes exactly like it would in a component.

```ts
const useSettingsState = () => {
  const [taxRate, setTaxRate] = useState(0.1)
  return { taxRate, setTaxRate }
}
export const { useStore: useSettingsStore } = createStore('settings', useSettingsState, {
  initialState: { taxRate: 0.1 },
})

const useInvoiceState = ({ invoiceId }: { invoiceId: string }) => {
  const { taxRate } = useSettingsStore() // a store inside a store
  const [subtotal, setSubtotal] = useState(0)
  return { subtotal, setSubtotal, total: subtotal * (1 + taxRate) }
}
export const { useStore: useInvoiceStore } = createStore('invoice', useInvoiceState)
```

When `taxRate` changes, the `invoice` store re-renders, recomputes `total` and publishes it. Consumers of `useInvoiceStore` that read `total` re-render; consumers that read only `subtotal` do not.

The inner store is mounted by the same `AutoRootCtx` and is torn down when the outer store, its last consumer, is torn down.

## Derived values in a plain hook

A derived value that only one component needs can stay in an ordinary hook instead of a store:

```ts
const useCartTotal = () => {
  const { items } = useCartStore()
  return items.reduce((total, item) => total + item.price, 0)
}
```

This re-renders the calling component whenever `items` changes. To re-render only when the derived value changes, use a [selector](/guide/selectors):

```ts
const total = useCartStore(undefined, s => s.items.reduce((sum, i) => sum + i.price, 0))
```

## Cycles

A cycle (store A reads store B, store B reads store A) is reported with a development warning. If the cycle also diverges, each store's update causing the other to update forever, React's nested-update limit stops it: the publishing store's hook throws "Maximum update depth exceeded", its [error boundary](/guide/error-handling) disables that store, and the error is logged. The rest of the app keeps running.
