# Introduction

`react-state-custom` lets you write a hook once and use it anywhere. A custom hook is reused as code, not as state: call it in three components and it runs three times, with three `useState`s, three fetches and three values that can drift apart. Wrap the same hook with `createStore` and every caller, component or other store, shares one running instance: one state, one fetch. There are no reducers, actions, atoms or store objects to learn.

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

- **Shared, not duplicated.** A store is called like a hook, anywhere. The hook runs once per params, however many components and stores call it.
- **Composition.** A store hook can call other stores, so dependencies update automatically.
- **Progressive data.** Each source fetches on its own and a combining store shows every piece as soon as it arrives. See [Progressive data](/guide/progressive-data).
- **Selective re-renders.** `useStore` returns a proxy that records which keys a component reads during render and subscribes to exactly those. Selectors handle deep or derived reads.
- **Automatic lifecycle.** No providers per store. `AutoRootCtx` mounts a store when it is first needed and tears it down when it is no longer used, after an optional grace period.
- **Parameterized instances.** `useStore({ listId: 'work' })` and `useStore({ listId: 'home' })` are two independent instances of one definition.
- **Escape hatches.** `getStore()` for sockets, routers and tests; `useStoreSuspense()` for Suspense; `StateScopeProvider` for isolated subtrees.
- **TypeScript first.** Params and state are inferred from the hook. Keys given in `initialState` are typed as always present.

## When it fits

A store pays off when several components need the same running piece of state, effects included, per id.

- **A good fit**
  - A socket, a presence channel or a poll per room, symbol or document, read by several widgets: one subscription and one state for all of them.
  - A task in progress, such as an upload or an export, followed on more than one screen. See [Keep a task running after its screen closes](/guide/outside-react#keep-a-task-running-after-its-screen-closes).
  - A screen's state combined from several sources: fetched data, a socket, the session. See [Progressive data](/guide/progressive-data).
  - Domain hooks you already have and now need to share: wrap them with `createStore` and they run as written.
- **A small gain**
  - Global UI flags such as the theme or an open modal: a context or a plain store does this already.
  - Server data you only fetch and cache: a query library already shares responses per key. Combine its results in a store when you need more.
  - State that belongs to one component: keep it in `useState`.
- **Not a fit**
  - Logic that must run without React. A store is a hook: `getStore()` reads and drives it from outside, but it runs only under a mounted `AutoRootCtx`.

Sharing changes behaviour: callers with the same params share everything the hook holds. Decide what belongs to the shared instance and what stays with each view; see [What an instance shares](/guide/parameterized-stores#what-an-instance-shares).

An update takes two commits: the store renders and publishes, then its consumers render, each once, and each store in a chain of stores adds one commit. In the [benchmarks](/benchmarks), updates that re-render consumers cost 1.6 to 2.6 times what Jotai spends in jsdom, and 1.1 to 1.6 times in Chrome, where style and layout are measured too. A derived store runs once per change where a selector runs in every consumer. The [Limitations and FAQ](/guide/limitations) page lists the other constraints.

## Where to go next

- [Getting started](/guide/getting-started) walks through the four steps of a real app.
- [How it works](/guide/how-it-works) explains the model in one page.
- The [API reference](/api/create-store) documents every export.
- The [live demo](https://vothanhdat.github.io/react-state-custom/) has editable examples: counter, live chat rooms, todo list, selectors and Suspense, nested state read three ways, timer, outside React, async data, composed stores and scoped state. Live Rooms shows the model best: one connection per room shared by several widgets, closed with the room, and messages kept in a store of their own.
