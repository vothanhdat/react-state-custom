# Limitations and FAQ

## Limitations

**Params must be primitives.** Store identity is a serialized string, so params are limited to `string`, `number`, `bigint`, `boolean`, `null` and `undefined`. Pass ids and look objects up inside the hook.

**Stores commit before their consumers.** A store is a hook in a headless component, so its new value exists only after that component renders and commits. It publishes from a layout effect, and only the consumers that read a changed key render, in a second, synchronous commit. Every component renders once per change (StrictMode doubles render calls in development, not commits), and updates made in the same task are batched: a thousand `setState` calls in one handler give one store render and one consumer render. Updates spread over separate tasks give one pair of commits per task; buffer them in the store (for example flush once per animation frame) to get one pair per frame. Against Zustand or Jotai, which render consumers directly, that is about twice the cost per update, and still well under a frame at a thousand subscribed components. Each store in a chain of stores adds one more commit. See [Benchmarks](/benchmarks).

What decides frame time is usually the DOM, not the store: reconciling rendered elements, style, layout and paint. A store feeding a canvas, a chart or WebGL from a hook, with little HTML to update, runs smoothly at 120 fps. To go faster, update less HTML: selectors, keyed collections, `ref` writes for values that tick, `transform` and `opacity` for motion. Then watch allocations per frame (a new array on every update means GC pauses) and batch several updates in one frame into one.

**One extra render per consumer on mount** when `initialState` is absent or does not match the hook's first publish.

**Layers are one commit apart.** A store publishes one commit after the stores it reads. A component that reads both a store and a store derived from it can, for one render, see the new value next to the old derived one. Nothing is painted in between, but render logic and effects see it. Render from the derived store only and re-export the raw values it needs; values published by the same store always arrive together. See [Progressive data](/guide/progressive-data#combine-in-a-store-render-from-it).

**Store hooks see the providers above `AutoRootCtx`.** A store hook runs inside `AutoRootCtx`, not inside the component that calls `useStore`, so `useContext` in a store reads the providers wrapping `AutoRootCtx`. Put the query client, router, theme or i18n providers a store needs outside it.

**Transitions stop at the store.** An action called inside `startTransition` makes the store's render a transition, but its consumers update in a regular commit afterwards. Transitions around component state, such as a param change with `useStoreSuspense`, work as usual. Defer expensive consumers with `useDeferredValue` instead. See [Concurrent rendering](/guide/concurrent).

**Stores start when their consumer commits.** `useStore` starts its store from an effect, so a component in a Suspense boundary that is showing its fallback starts its store only once that boundary commits. `useStoreSuspense` starts its store while suspended. See [Load in parallel](/guide/concurrent#load-in-parallel).

**A hidden `<Activity>` releases its stores.** Effects inside `<Activity mode="hidden">` are cleaned up, so its `useStore` calls release their instances as an unmount would. Keep `AutoRootCtx` outside it, and use `timeToClean` or a `preState` warm start to keep state. See [Hidden content with `<Activity>`](/guide/concurrent#hidden-content-with-activity).

**Client only.** Store hooks never run on the server. Server HTML shows `initialState`. See [Server-side rendering](/guide/ssr).

**`getStore` is global-scope only.** Instances inside a `StateScopeProvider` are reachable from components through `useCtxState`, not from module-level code.

**No in-place recovery after a store throws.** The error boundary disables the instance until it is torn down and mounted again. Catch inside the hook when you need recovery.

**Top-level key tracking.** The proxy subscribes to top-level keys. Use a selector for deep or derived values, and keep a list of independently changing items as an object keyed by id rather than an array under one key. See [Collections](/guide/selectors#collections-keys-not-arrays). A nested object from elsewhere can be [flattened in a shared store](/guide/composing-stores#flatten-a-nested-source).

## FAQ

### Do I need a provider?

One `AutoRootCtx` near the root, mounted once. No provider per store. `StateScopeProvider` is only for isolated subtrees.

### Why do I see `undefined` on the first render?

The store hook has not run yet; stores are lazy. Read with `??` or `?.`, or pass `initialState` to seed the values and type those keys as present. See [Store options](/guide/store-options#initialstate).

### A consumer re-renders more than I expect

- It reads a key that changes, even if it only uses part of that key's value: use a [selector](/guide/selectors), or publish the parts as their own keys ([Flatten a nested source](/guide/composing-stores#flatten-a-nested-source)).
- It spreads the proxy (`{ ...store }`, `Object.entries(store)`), which subscribes to every key. A warning is logged for this.
- Its store returns a fresh object or array on every render for some key, so `Object.is` sees a change. Memoize with `useMemo` inside the hook.
- StrictMode doubles renders in development.

### Two stores return the same state

They probably share a name. A store's name is its identity: two `createStore` calls with the same name share one instance, and only one of the hooks runs. A development error is logged when that happens.

### Can a store read another store?

Yes, call the other store's `useStore` inside the hook. See [Composing stores](/guide/composing-stores). Cycles are warned about in development.

### How do I keep state across route changes?

Give the store a `timeToClean` so the instance survives the gap between the last consumer unmounting and the next one mounting. Or `retain()` it from a long-lived module.

### How do I reset a store?

Unmount every consumer and let it tear down, or expose a `reset` action from the hook. For per-instance resets, change a param: a new identity is a fresh instance.

### What happens to a store when I edit it with hot reload on?

The running instance picks up the new hook and keeps its state, like a component under Fast Refresh. If the edit added, removed or reordered hooks, the old state no longer fits: the instance restarts with the new hook, and `preState` holds what it last published. A hook that still throws after the restart is disabled like any failing store. Editing a hook that the store calls from another module can also change its hooks; it is handled the same way.

### Does it work with React 18?

Yes. `react >= 18` is the peer range, nothing React 19-specific is used, and CI runs the test suite on React 18.3 as well as 19.

### Does it work with the React Compiler?

Yes, with a dedicated test run in CI. See [React Compiler](/guide/react-compiler).

### Where is the dev tool?

In a separate entry: `react-state-custom/dev-tool` plus `react-state-custom/style.css`. See [Developer tools](/guide/devtools).

### Can I use it without `createStore`?

Yes. `createRootCtx` and `createAutoCtx` are the layers underneath, and the `Context` class with its hooks is the pub/sub primitive. See [Primitives](/api/primitives).
