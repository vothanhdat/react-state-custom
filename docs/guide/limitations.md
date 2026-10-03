# Limitations and FAQ

## Limitations

**Params must be primitives.** Store identity is a serialized string, so params are limited to `string`, `number`, `bigint`, `boolean`, `null` and `undefined`. Pass ids and look objects up inside the hook.

**Two commits per update.** A store is a hook in a headless component: an update re-renders the store, which publishes from a layout effect, then the subscribed consumers render. That is about twice the cost of Zustand or Jotai per update, and still well under a frame at a thousand subscribed components. Each store in a chain of stores adds one more commit. See [Benchmarks](/benchmarks).

**One extra render per consumer on mount** when `initialState` is absent or does not match the hook's first publish.

**Layers are one commit apart.** A store publishes one commit after the stores it reads. A component that reads both a store and a store derived from it can, for one render, see the new value next to the old derived one. Nothing is painted in between, but render logic and effects see it. Render from the derived store only and re-export the raw values it needs; values published by the same store always arrive together. See [Progressive data](/guide/progressive-data#combine-in-a-store-render-from-it).

**Store hooks see the providers above `AutoRootCtx`.** A store hook runs inside `AutoRootCtx`, not inside the component that calls `useStore`, so `useContext` in a store reads the providers wrapping `AutoRootCtx`. Put the query client, router, theme or i18n providers a store needs outside it.

**Client only.** Store hooks never run on the server. Server HTML shows `initialState`. See [Server-side rendering](/guide/ssr).

**`getStore` is global-scope only.** Instances inside a `StateScopeProvider` are reachable from components through `useCtxState`, not from module-level code.

**No in-place recovery after a store throws.** The error boundary disables the instance until it is torn down and mounted again. Catch inside the hook when you need recovery.

**Top-level key tracking.** The proxy subscribes to top-level keys. Use a selector for deep or derived values, and keep a list of independently changing items as an object keyed by id rather than an array under one key. See [Collections](/guide/selectors#collections-keys-not-arrays).

## FAQ

### Do I need a provider?

One `AutoRootCtx` near the root, mounted once. No provider per store. `StateScopeProvider` is only for isolated subtrees.

### Why do I see `undefined` on the first render?

The store hook has not run yet; stores are lazy. Read with `??` or `?.`, or pass `initialState` to seed the values and type those keys as present. See [Store options](/guide/store-options#initialstate).

### A consumer re-renders more than I expect

- It reads a key that changes, even if it only uses part of that key's value: use a [selector](/guide/selectors).
- It spreads or enumerates the proxy, which subscribes to every key. A warning is logged for this.
- Its store returns a fresh object or array on every render for some key, so `Object.is` sees a change. Memoize with `useMemo` inside the hook.
- StrictMode doubles renders in development.

### Can a store read another store?

Yes, call the other store's `useStore` inside the hook. See [Composing stores](/guide/composing-stores). Cycles are warned about in development.

### How do I keep state across route changes?

Give the store a `timeToClean` so the instance survives the gap between the last consumer unmounting and the next one mounting. Or `retain()` it from a long-lived module.

### How do I reset a store?

Unmount every consumer and let it tear down, or expose a `reset` action from the hook. For per-instance resets, change a param: a new identity is a fresh instance.

### Does it work with React 18?

Yes. `react >= 18` is the peer range. Nothing React 19-specific is used.

### Does it work with the React Compiler?

Yes, with a dedicated test run in CI. See [React Compiler](/guide/react-compiler).

### Where is the dev tool?

In a separate entry: `react-state-custom/dev-tool` plus `react-state-custom/style.css`. See [Developer tools](/guide/devtools).

### Can I use it without `createStore`?

Yes. `createRootCtx` and `createAutoCtx` are the layers underneath, and the `Context` class with its hooks is the pub/sub primitive. See [Primitives](/api/primitives).
