# Limitations and FAQ

## Limitations

**Params must be primitives.** Store identity is a serialized string, so params are limited to `string`, `number`, `bigint`, `boolean`, `null` and `undefined`. Pass ids and look objects up inside the hook.

**Stores commit before their consumers.** A store is a hook in a headless component, so its new value exists only after that component renders and commits. It publishes from a layout effect, and only the consumers that read a changed key render, in a second, synchronous commit. Every component renders once per change (StrictMode doubles render calls in development, not commits), and updates made in the same task are batched: a thousand `setState` calls in one handler give one store render and one consumer render. Updates spread over separate tasks give one pair of commits per task; buffer them in the store (`useFrameState`, or `scheduled(publish, frame())`) to get one pair per frame, and let views that need less follow at their own [cadence](/guide/update-cadence). Zustand and Jotai render consumers directly; in the [benchmarks](/benchmarks), updates that re-render consumers cost 1.3 to 2.1 times what Jotai spends in jsdom, and 1.1 to 1.3 times in Chrome. Each store in a chain of stores adds one more commit.

jsdom does no layout or paint; the Chrome runs include style and layout, and the gap is smaller there. In a page, an update also costs the DOM work of every component it re-renders: reconciling, style, layout and paint. To keep that small, update less HTML: selectors, keyed collections, `ref` writes for values that tick, `transform` and `opacity` for motion. Then watch allocations per frame (a new array on every update means GC pauses) and batch several updates in one frame into one.

**Nothing is ready at the start.** Stores are lazy: a store starts when its first reader commits, so that reader renders once with every key `undefined`, actions included, then again with the data. Write readers that render a loading state from `undefined`; see [Before the data arrives](/guide/getting-started#before-the-data-arrives).

**Actions belong to an instance.** An action keeps its identity while its instance runs. When the instance is torn down and a new one starts (after `timeToClean`, an error, a hot update), the new one has new actions, and those of the old one do nothing. An effect that lists an action runs again then; see [Before the data arrives](/guide/getting-started#before-the-data-arrives) for which effects should list one.

**Scheduled readers lag.** A component reading with a `schedule` shows a change up to its period late: a frame, a throttle or debounce period, an idle wait. Two components showing one value at different cadences can disagree for that long. Schedule leaf views, and read `storeRef(params).get()` in handlers that decide. See [Update cadence](/guide/update-cadence#consistency).

**Layers are one commit apart.** A store publishes one commit after the stores it reads. A component that reads both a store and a store derived from it can, for one render, see the new value next to the old derived one. Nothing is painted in between, but render logic and effects see it. Write readers that tolerate it: check values before reading them, join by id rather than by position, and make decisions from one store. Or render from the derived store only and re-export the raw values it needs, since values published by the same store always arrive together. See [Data across stores](/guide/how-it-works#data-across-stores).

**Store hooks see the providers above `AutoRootCtx`.** A store hook runs inside `AutoRootCtx`, not inside the component that calls `useStore`, so `useContext` in a store reads the providers wrapping `AutoRootCtx`. Put the query client, router, theme or i18n providers a store needs outside it.

**Transitions stop at the store.** An action called inside `startTransition` makes the store's render a transition, but its consumers update in a regular commit afterwards. Transitions around component state work as usual. Defer expensive consumers with `useDeferredValue` instead. See [Concurrent rendering](/guide/concurrent).

**Stores start when their consumer commits.** `useStore` starts its store from an effect, so a component in a Suspense boundary that is showing its fallback starts its store only once that boundary commits. See [Load in parallel](/guide/concurrent#load-in-parallel).

**A hidden `<Activity>` releases its stores.** Effects inside `<Activity mode="hidden">` are cleaned up, so its `useStore` calls release their instances as an unmount would. Keep `AutoRootCtx` outside it, and use `timeToClean` to keep state. See [Hidden content with `<Activity>`](/guide/concurrent#hidden-content-with-activity).

**Client only.** Store hooks never run on the server, where `useStore` returns `{}`. See [Server-side rendering](/guide/ssr).

**No in-place recovery after a store throws.** The store's error boundary disables the instance until it is torn down, and its readers throw the error for their own boundaries. Catch inside the hook when you need recovery.

**Top-level key tracking.** The proxy subscribes to top-level keys. Use a selector for deep or derived values, and keep a list of independently changing items as an object keyed by id rather than an array under one key. See [Collections](/guide/selectors#collections-keys-not-arrays). A nested object from elsewhere can be [flattened in a shared store](/guide/composing-stores#flatten-a-nested-source).

## FAQ

### Do I need a provider?

One `AutoRootCtx` near the root, mounted once. No provider per store.

### Why do I see `undefined` on the first render?

The store hook has not run yet; stores are lazy, and nothing is ready at the start by design. Read with `??` or `?.` and call actions with `?.()`. See [Before the data arrives](/guide/getting-started#before-the-data-arrives).

### A consumer re-renders more than I expect

- It reads a key that changes, even if it only uses part of that key's value: use a [selector](/guide/selectors), or publish the parts as their own keys ([Flatten a nested source](/guide/composing-stores#flatten-a-nested-source)).
- It spreads the proxy (`{ ...store }`, `Object.entries(store)`), which subscribes to every key. A warning is logged for this.
- Its store returns a fresh object or array on every render for some key, so `Object.is` sees a change. Memoize with `useMemo` inside the hook.
- The data really changes that often, faster than anyone reads it: give the reader a [`schedule`](/guide/update-cadence) such as `frame()` or `throttle(100)`.
- StrictMode doubles renders in development.

### Two stores return the same state

They probably share a name. A store's name is its identity: two `createStore` calls with the same name share one instance, and only one of the hooks runs. A development error is logged when that happens.

### Can a store read another store?

Yes, call the other store's `useStore` inside the hook. See [Composing stores](/guide/composing-stores). Cycles are warned about in development.

### How do I keep state across route changes?

Give the store a `timeToClean` so the instance survives the gap between the last consumer unmounting and the next one mounting. Or `retain()` it from a long-lived module.

### How do I reset a store?

Unmount every consumer and let it tear down, or expose a `reset` action from the hook. For per-instance resets, change a param: a new identity is a fresh instance. To reset every store, remount `AutoRootCtx` with a new `key`.

### What happens to a store when I edit it with hot reload on?

The running instance picks up the new hook and keeps its state, like a component under Fast Refresh. If the edit added, removed or reordered hooks, the old state no longer fits: the instance restarts with the new hook, from its own initial state, as a component does under Fast Refresh. A hook that still throws after the restart is disabled like any failing store. Editing a hook that the store calls from another module can also change its hooks; it is handled the same way.

### Does it work with React 18?

Yes. `react >= 18` is the peer range, nothing React 19-specific is used, and CI runs the test suite on React 18.3 as well as 19.

### Does it work with the React Compiler?

Yes, with a dedicated test run in CI. See [React Compiler](/guide/react-compiler).

### Where is the dev tool?

In a separate entry: `react-state-custom/dev-tool` plus `react-state-custom/style.css`. See [Developer tools](/guide/devtools).

### Can I use it without `createStore`?

No. The API is `createStore`, `useMultipleStore` and `AutoRootCtx`; the layers under them are internal. `storeRef(params)` covers code outside React.

### How do I read a list of instances?

`useStore` follows the rules of hooks, so it cannot be called once per item in a loop. [`useMultipleStore(refs)`](/api/use-multiple-store) reads any number of instances in one call: `useMultipleStore(ids.map(id => taskRef({ id })))`.
