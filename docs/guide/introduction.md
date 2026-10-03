# Introduction

`react-state-custom` turns a standard React hook into a shared store. If you can write a hook, you have already written the store: there are no reducers, actions, atoms or store objects to learn.

```tsx
const useCartState = ({ userId }: { userId: string }) => {
  const [items, setItems] = useState<Item[]>([])
  const addItem = (item: Item) => setItems(list => [...list, item])
  const total = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items])
  return { items, addItem, total }
}

export const { useStore: useCartStore } = createStore('cart', useCartState, {
  initialState: { items: [], total: 0 },
})
```

Every component that calls `useCartStore({ userId: '42' })` shares one running instance of that hook. Each component re-renders only when a key it read changes. When the last consumer unmounts, the hook's effects clean up and the instance is discarded.

## What you get

- **Zero boilerplate.** State, effects, derived values and actions are written with the hooks you already use.
- **Selective re-renders.** `useStore` returns a proxy that records which keys a component reads during render and subscribes to exactly those. Selectors handle deep or derived reads.
- **Automatic lifecycle.** No providers per store. `AutoRootCtx` mounts a store when it is first needed and tears it down when it is no longer used, after an optional grace period.
- **Parameterized instances.** `useStore({ listId: 'work' })` and `useStore({ listId: 'home' })` are two independent instances of one definition.
- **Composition.** A store hook can read other stores, so dependencies update automatically.
- **Escape hatches.** `getStore()` for sockets, routers and tests; `useStoreSuspense()` for Suspense; `StateScopeProvider` for isolated subtrees.
- **TypeScript first.** Params and state are inferred from the hook. Keys given in `initialState` are typed as always present.

## When to use something else

A store here is a hook running in a headless component, so every update is two React commits: the store renders and publishes, then its consumers render. That costs about twice what Zustand or Jotai spend per update (see [Benchmarks](/benchmarks)). It is well under a frame at a thousand subscribed components, but if you update thousands of subscribed components per frame, a plain external store is the better tool. The [Limitations and FAQ](/guide/limitations) page lists the other constraints.

## Where to go next

- [Getting started](/guide/getting-started) walks through the four steps of a real app.
- [How it works](/guide/how-it-works) explains the model in one page.
- The [API reference](/api/create-store) documents every export.
- The [live demo](https://vothanhdat.github.io/react-state-custom/) has editable examples: counter, todo list, selectors and Suspense, timer, outside React, async data, composed stores and scoped state.
