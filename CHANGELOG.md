# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [1.9.0] - 2026-10-05
### Added
- A `schedule` for readers: when a component re-renders for a change of the store it reads. `useStore(params, { schedule })` and `useStore(params, selector, { isEqual, schedule })` take a scheduler from a factory exported by the package: `frame()` (once per animation frame), `throttle(ms)` (at once, then at most once per period with the last change), `debounce(ms, { maxWait })` (once changes stop, and at least every `maxWait`, 1000 ms by default), `idle(ms)` (when the browser is idle, at most `ms` later) or `sync()` (at once, the default). Only the factories an app imports end up in its bundle, and each returns the same scheduler for the same arguments, so it can be called inline. A scheduler is an object with a `task(run)` method, so an app can write its own. `createStore(name, useFn, { schedule })` sets the default for every reader of a store, `useStoreSuspense` included. Only the reader's re-render waits: the store, `getStore()`, actions and the other readers see a change at once, and the render reads the data of its moment, so a change undone meanwhile renders nothing. A store's first data is never held back. Readers due at the same moment (one frame, one throttle tick, one idle callback) render in one React commit. For views that follow fast data without needing every value, such as charts, logs and totals; see Update cadence in the docs. In the trading demo, throttling the depth chart and equity and rendering history and fills when idle took the depth chart from 60 to 10 commits per second and script time down by about 5% at 20× and 50× feed speed (headless Chrome, production build); the order book ladder, which stays on every frame, is most of that app's work.
- `useFrameState(initial)`: a `useState` whose updates apply once per animation frame, in order, with one render. In a store fed by a socket, the store renders and publishes once per frame instead of once per message, in the same frame as its readers on `frame()`.
- `scheduled(fn, scheduler)`: `fn` on a scheduler, for code outside render, such as a socket handler that collects messages in a buffer and publishes once per frame. The calls made before a run are one run, with the last arguments; `cancel()` and `flush()` on the returned function.
- `flushScheduled()` in `react-state-custom/testing` runs every pending scheduled render, `useFrameState` update and `scheduled` call. `resetStores()` also forgets pending ones.
- `useStore(selector, isEqual | options?)` for a store without required params. It took `useStore(undefined, selector)`; the old form still works. A call that passes read options as the params of such a store, `useStore({ schedule: frame() })`, throws a development error that says so.
- Exports the types `Scheduler`, `ScheduledTask`, `StoreReadOptions` and `StoreSelectOptions`.
- Docs: new pages Update cadence, Organizing stores in layers (domain, core stores that own IO, UI stores and hooks, views; with an import-direction test), Events from a store (a listener API on the store and a notifier store in the UI layer, instead of a "last event" key or a store calling the UI) and Realtime data (snapshot and sequenced deltas, gaps, reconnects, history merged with the live stream). The testing guide shows how to fake a socket and API module to reproduce races, and how to test scheduled readers. The README compares with RTK Query, and notes that Jotai 3 moved `atomFamily` to the `jotai-family` package.
- `demos/trading`: a realtime trading terminal built on the library (`yarn demo:trading`): a simulated exchange of 200 markets sending up to ~1,100 messages a second, an order book with sequence gaps and resyncs, candles, an order ticket validated against the book and balances, optimistic orders, stores in layers with tests per layer.

### Fixed
- `timeToClean: Infinity` tore the instance down as soon as its last reader left instead of keeping it: a timer longer than 2³¹ − 1 ms runs at once. A `timeToClean` that long or longer now keeps the instance until `AutoRootCtx` unmounts.
- `useDataSubscribe(ctx, key, ms)` and `useDataSubscribeMultipleWithDebounce` never rendered a key that changed more often than the debounce time: each change restarted the wait. They now render at least once a second (or every `ms`, when longer) while changes go on. Their last argument also takes a scheduler.
- Docs: the advice to list an action in an effect's dependencies so the effect runs again once the action exists. That holds for an effect that only calls the action. An effect that does other work, such as opening a socket whose messages call an action from another store, closed and reopened its socket when the action arrived, or not, depending on whether the other store was already running. Getting started now says which effects should list an action, and to read the others through `useEffectEvent`, a ref, or an event.

### Changed
- The library in a Vite production app that uses `createStore` and `AutoRootCtx` only grows by about 0.9 kB minified, 0.4 kB gzipped (17.6 → 18.5 kB, 7.0 → 7.4 kB). Each scheduler imported adds its own code: `throttle` about 1.1 kB minified; all of them with `scheduled` and `useFrameState`, 22.5 kB minified, 8.8 kB gzipped in all.

## [1.8.0] - 2026-10-05
### Added
- `react-state-custom/testing`, an entry with helpers for tests. Each takes a store by any function `createStore` returned for it, so a module that exports only `useStore` is enough, and is typed from it.
  - `mockStore(useStore, values)` makes the instances that start afterwards publish `values` (some keys or all, checked against the store's type) instead of running the store's hook; `values` can also be a hook of `(params, preState)`, which may use hooks or throw to fail the store. The store's `AttachedComponent` does not run. `set(values)` on the returned handle merges new values in and re-renders the readers; `restore()` stops mocking. Mocks apply in every scope. A component test no longer needs the network or the stores behind the one it reads.
  - `resetStores()` removes the mocks and drops every cached context with its state, for an `afterEach`. Tests used to clear `getContext.cache`, an internal detail.
  - `storeHandle(useStore, params)` returns the `getStore(params)` handle, also for a store whose module does not export `getStore`; reaching one used to take `getContext('name?params')` and the internal instance name.
  - `waitForStore(useStore, params, keys | isReady?, { timeout }?)` resolves with the state once the store has published, the keys hold values (typed as present) or the predicate holds; it rejects with the store's error if it fails, and after the timeout (1000 ms) with the reason. While it waits React's act environment is off, as in Testing Library's `waitFor`, so the store's own updates log no act warnings.

### Fixed
- Types under TypeScript's `moduleResolution: "node16"` or `"nodenext"`. The declarations imported each other without file extensions, which that resolution rejects in ES modules, so with `skipLibCheck` (the usual setting) every type of the library was silently `any`; and a CommonJS file importing the package got error TS1479 on every import, because the `require` condition shared the ESM declarations of a `"type": "module"` package. Declarations now import with extensions, and each has a CommonJS twin (`.d.cts`) that the `require` conditions of `exports` point to. `bundler` and `node10` resolution were not affected and read the same `.d.ts` files as before. CI now type-checks an app importing the built package under each resolution, as ES module and as CommonJS, with `skipLibCheck` off.
- Under `node10` resolution without `esModuleInterop`, the declarations' default import of React was an error; with `skipLibCheck` it was hidden and the React types in them resolved to `any`, so the dev tool's components were typed `any`. The library now imports React as a namespace.

## [1.7.0] - 2026-10-05
### Added
- `shallowEqual(a, b)`, for the `isEqual` argument of `useStore(params, selector, isEqual)`: `Object.is` one level deep over arrays, plain objects, `Map`s and `Set`s, so a selector that returns a fresh array with the same items does not re-render its component. The docs used it without the library exporting one.

### Fixed
- A torn-down store instance could still run. Its context stayed cached for 100 ms with everything it had published, actions included, and a component that mounted in that window, or that restored the context (inside an `<Activity>` shown again), got the dead instance's actions. Calling one from an effect, as in `useEffect(() => { load?.() }, [load])`, ran the dead instance's closure: its fetch, its subscription. The effect then ran again for the new instance, so the work was done twice. Now the actions of a hook that stopped running do nothing, and when the instance is torn down they leave its context, so such a component reads them as `undefined`, as before any instance ran. The same applies to the actions of a store that threw: calling them no longer runs the failed hook's closures.
- `initialState` typed every key of the store as present, actions included, when it held a string literal without `as const` (`{ status: 'loading' }`): TypeScript widened `'loading'` to `string`, the object no longer matched the store's type, and the result fell back to "every key seeded". A consumer could then call an action or read `ids.length` with no check and crash on the first render. `createStore` and `createAutoCtx` now infer only the keys of `initialState` and check each value against the hook's type: `{ status: 'loading' }` needs no cast, only the keys it holds are typed as present, and a misspelled key or a value the hook never returns is a type error. Code that compiled only because of the old typing gets type errors at those reads, which were unchecked. As before, a string literal returned from the function form needs `as const`. A seed with keys the store's type lacks, such as a record spread next to named keys, needs the hook's return type to keep the record's index signature (see Collections under Selectors in the docs).

### Changed
- When a store instance is torn down (`timeToClean` after its last reader) and nothing holds its context, the context is dropped at once instead of 100 ms later. A component mounting in that window starts a fresh instance from `initialState`, instead of rendering the old instance's values once. That 100 ms grace predates `timeToClean`; keep state across a remount with `timeToClean`. `preState` still warm-starts an instance whose context something holds: a restart after an error or a hot update, an `<Activity>` shown again, a `getStore().subscribe` listener. `getStore().ready` and `useStoreStatus().ready` turn false once the instance is torn down. In the task-manager demo, coming back to a project right after leaving it no longer renders a row whose task is `undefined`.
- Docs: values from different stores can disagree for one render, and readers are written to tolerate it rather than avoid it. How it works describes stores as services that own their data, IO and lifetime, and a "Data across stores" section: check before reading (with `noUncheckedIndexedAccess` so `tasks[id]` is typed `Task | undefined`), join by id rather than by position, and keep decisions that need several stores in one store. Getting started gains "Before the data arrives" (data and actions are `undefined` until the store runs; call actions with `?.()` from handlers, and list them as effect dependencies). The Collections section shows rows that take an id, read their item with a selector and check for a missing one, and two shapes for items with their own fetch: a store per id, or one collection store with a `subscribe(id)` action that counts readers.

## [1.6.0] - 2026-10-04
### Performance
- An update that changes many keys of one store, such as a collection kept as an object keyed by id, costs time linear in the keys. A store update notifies its subscribers once per changed key, and the `useStore()` proxy, `useDataSubscribeMultiple` and `getStore().subscribe` redid their work on each notification: the proxy compared the keys it had read up to the first changed one (or listed every key, for `Object.keys(store)`), the multi-key hook re-read every key, and the handle copied the full state for each call. Mounting a component that reads many keys that already hold values was quadratic for the same reason, as subscribing reports each present key at once. Each now does its work once per update. With 4000 keys in jsdom, every key changing: a component listing them ~900 ms → ~2.5 ms, `useDataSubscribeMultiple` ~362 ms → ~2.6 ms, one `getStore().subscribe` listener ~2.6 s → ~3.0 ms. The last 2000 changing, a component reading all 4000: ~48 ms → ~1.9 ms (when every key changes, its check stops at the first one, so that case was already fast). Mounting and unmounting a component that reads all 4000: ~199 ms → ~1.5 ms.
- Starting a store instance no longer captures a JavaScript stack, which it did in production too, for an error thrown only when one instance is mounted twice. That was about a third of the cost of starting an instance: mounting 5000 instances at once ~440 ms → ~260–320 ms (jsdom). The error is unchanged; the error boundary reports where it happened with React's component stack, and the captured stack only ever pointed into React and the library.
- Development-only code is removed from production bundles built with Vite or Rollup, or minified with terser as webpack does. Every check read one `isProduction` constant computed inside a `try`/`catch`, which minifiers cannot fold, so the development warnings, their text, the read-only proxy traps and the dependency graph all shipped to production. The constant is now plain `process.env.NODE_ENV === 'production'`: the app's bundler replaces the expression and the minifier drops the branches. The library in a Vite production app: ~22.1 kB → ~17.4 kB minified, ~8.8 kB → ~7.0 kB gzipped. Bundling with esbuild alone keeps most of them, as before. It is read once, not at each check: in Node (tests, server rendering of unbundled packages) a `process.env` read costs about 150 ns, which at every check would make updates 6–16% slower in the jsdom benchmarks.

### Fixed
- Two React roots hydrated from server HTML (islands), each with a `StateScopeProvider`, get separate scopes. The scope id came from `useId`, which numbers a hydrated root by tree position, so both scopes had the same id and shared their stores: two `AutoRootCtx` ran in one scope, the store mounted twice was disabled, and the islands stopped responding. Scope ids are now unique in the page. Roots created with `createRoot` were not affected.

### Changed
- Like React, the library needs `process.env.NODE_ENV` to be replaced by a bundler, or defined by the CDN serving it (esm.sh does). A runtime fallback let `dist/index.es.js` load in a browser with no bundler at all; there, importing it now throws `process is not defined`.
- `getStore().subscribe` passes the same snapshot object to every call of one update (one call per changed key, as before) instead of a fresh copy for each. Treat it as read-only.

## [1.5.1] - 2026-10-04
### Fixed
- `useStoreSuspense(params, keys)` types listed keys as present only when `keys` is a tuple: a list written in the call or kept `as const`. A widened array such as `readonly ('items' | 'add')[]` holding only `'items'` typed `add` as present too, although the component waited for `items` alone and `add` could be `undefined`. Such an array is now typed like `useStore`; what it waits for is unchanged.

## [1.5.0] - 2026-10-04
### Added
- `useStoreSuspense(params, keys)`: a list of keys in place of the predicate waits until each holds a value (seeded or published, `null` included) and types those keys as present, the others as optional. A predicate can hold on `initialState` before the store runs, so that render reads only the seeded keys although the result is typed as the full state; the key list keeps the type to what the render gets, and still renders at once when the seed holds every key. A development warning names a listed key the store later sets back to `undefined`. Exports the `StoreStateWith` type.
- `useStoreStatus(params?)`, returned by `createStore`: `{ ready, failed, error }` for the instance, re-rendering only when that changes. A store hook that crashed left `useStore` consumers on its last values, so one that failed before its first result kept showing `initialState` (a spinner that never stopped) with no way to tell. It works in a `StateScopeProvider`, unlike `getStore().error`, and inside another store, which can publish the failure of a store it reads.

## [1.4.0] - 2026-10-03
### Added
- A development warning when a `useStoreSuspense` render resolved by a predicate that held on `initialState` read a key the seed does not have. That render comes before the store runs, so the key was `undefined` although the result is typed as the full state; the warning names the key once the store has published a value for it. Rendering from the seed is kept: waiting for the store instead shows the fallback and delays the content by React's reveal throttle (about 300 ms).

### Fixed
- A selector (`useStore(params, selector)`, `useDataSelector`) no longer misses a change made between its component's render and its subscription. It recomputed only after its own listener had run, and React subscribes after the layout effects of the commit, so a store publishing in that commit left the component showing the old value until the next change. An event that both shows a component reading a selector and changes the store did this. Selectors now recompute after any change of the context, which counts them in `Context.revision`.
- `useStoreSuspense` consumers of one instance wait for their own predicates. The instance had one pending wait holding the predicate of the last component that suspended, so with `s => s.a` in one boundary and `s => s.b` in another, the first kept its fallback until `b` was ready too, and for good if the second component went away. The wait now resolves as soon as one predicate holds, and the components still not ready wait again.
- A component that goes away while `useStoreSuspense` is suspended no longer keeps its store running until the store gets ready. A suspended component never commits, so nothing released the retain it took; with a predicate the store never satisfied, the store ran, fetches and subscriptions included, until the page closed. The wait now wakes its components every 5 seconds: those still there wait again on the same instance, and the store of one that went away is released about a second later.
- `Object.keys(useStore())`, a spread, `for...in` and `'key' in store` follow keys being added and removed. Listing the keys subscribed to nothing and a spread only to the keys present at that render, so a list of a keyed collection never showed new items, and with a lazy store never showed any. Listing the keys now re-renders on additions and removals only; the development warning is kept for spreads, which read every value.
- A store named like an `Object.prototype` member (`constructor`, `toString`, `valueOf`, ...) starts. AutoRootCtx checked its instances with `key in records`, which counted inherited members, so such a store without params never mounted, and `__proto__` replaced the prototype instead of adding a key.
- The selector form of `useStore` requires the params a store requires. `useStore(undefined, selector)` type-checked for a store whose hook needs `{ id }`, and the hook ran with `{}`.
- `<DevToolContainer defaultOpen />` renders on the server. It read `window.innerHeight` during render and threw "window is not defined". The panel's open state and sizes remembered by the tab are now applied after mounting, so hydration also sees the markup the server sent.

## [1.3.2] - 2026-10-03
### Fixed
- A component reading the `useStore()` proxy keeps updating while a transition that re-renders it is suspended. The proxy recorded the keys of each render as it ran, so a render React then put aside (a transition waiting on a suspended sibling keeps the previous UI on screen) replaced the keys of the UI on screen: a component switching from `s.a` to `s.b` in that transition stopped following `a` and showed a stale value until the transition finished. Changes are now checked against the keys of the committed render.
- Selectors (`useStore(params, selector)`, `useDataSelector`) and `useDataSubscribeWithTransform` check changes with the selector of the committed render. They read the selector of the latest render, so in the same situation a component whose put-aside render selected a value equal to the one on screen (switching from `s => s.a` to `s => s.b` while `b` equalled `a`) missed the next change of `a`.

## [1.3.1] - 2026-10-03
### Fixed
- A store context created by a render that never commits is no longer cached forever. Components get their context during render, and only a committed component counts as a user, so a render that threw, suspended or was discarded left the context, and its dependency-graph entry in development, in the cache for good. A context created during render is now evicted after a second unless a user has committed; a render that commits later still finds or restores it.
- The `useStore()` proxy warns about spreading only in development, and once per store. The warning was logged in production builds too, on every render of every component that spread the proxy.
- Writing to the `useStore()` proxy throws a `TypeError` in development. `store.count = 1` wrote straight into the shared data without notifying anyone, so other readers kept the old value until the store published again. Production builds are unchanged, as React only freezes props in development.
- A `useStore` call site that passes a selector on some renders only (`useStore(p, cond ? select : undefined)`) gets an error naming the cause in development. The proxy and the selector form run different hooks, so React failed with an unrelated message ("Cannot create property ..."). TypeScript already rejects an optional selector; this covers JavaScript and non-null assertions.
- A store whose hook gains, loses or reorders hooks in a hot update restarts instead of being disabled. The running instance ran the new hook on the old hook state, React threw ("change in the order of Hooks") and the store stayed off until every consumer unmounted, so the page needed a reload. It now remounts once with the new hook, warm-started from `preState`; an edit that keeps the hooks still keeps the state.

### Changed
- React DevTools names every store after itself: the component running the hook of store `todos` is `Store(todos)`, so the DevTools search finds it. Every store was a `StateRunner`, and in the published package, which is minified, the other components showed mangled or empty names; `AutoRootCtx`, `Bucket`, `StoreInstance`, `StoreErrorBoundary`, `StoreFailure` and `StateScopeProvider` now have display names. The hot-reload boundary is merged into `StoreFailure`, one level less per store.
- CI runs the test suite on React 18.3 too. The peer range has always been `react >= 18`, but only React 19 was tested. Three tests relied on React 19 behavior (`use`, StrictMode reusing the first render's state) and now pass on both; the library needed no change.

### Performance
- `AutoRootCtx` renders only the buckets that hold a running instance instead of always 64, so an app with a few stores mounts a few `Bucket` components. Mounting `AutoRootCtx` with 3 stores: ~1.2 ms → ~0.6 ms. Mounting 1000 and 3000 instances at once: ~72 → ~67 ms and ~259 → ~210 ms; starting or stopping one instance is unchanged (jsdom). In `yarn bench`, updates that re-render no consumer are 31–49% faster than in 1.3.0 (shop `theme`: ~0.046 → ~0.024 ms), back to their level before the 64 buckets of 1.2.6; the other scenarios are unchanged within noise.

## [1.3.0] - 2026-10-03
### Fixed
- Functions returned by a store reach the consumers that call them while rendering. Every function was published as one stable wrapper, so a getter such as `useCallback(id => items[id], [items])`, a sort order kept in `useState`, or a component returned by the store never updated its consumers: they kept rendering the old result. A consumer that calls a store function during render (directly, through a selector, or in a memoized child it passes the function to) now re-renders when the store returns a new implementation, and a returned component remounts when it is replaced. Actions called from event handlers keep a stable identity and never re-render their readers.
- A store hook that suspends (`use(promise)`, a suspense query hook) no longer hides the whole app. Store hooks ran without a Suspense boundary of their own, so one suspending store showed the fallback of the boundary above `AutoRootCtx`, often the app's root. Each store and each `AttachedComponent` now has its own `<Suspense fallback={null}>`: the store publishes once it resumes, keeps its last values while it suspends again, and `useStoreSuspense` consumers wait in their own boundaries.
- A store hook that throws now reaches `useStoreSuspense` consumers: they throw its error into their own error boundary. A store that crashed before its first result left them on the Suspense fallback forever, and one that crashed later was invisible to them. The error still reaches the `Wrapper` passed to `AutoRootCtx`.
- Stores no longer stop for good when a second `AutoRootCtx` in the same scope unmounts. The newest root took over the stores but left its `subscribe` function published after unmounting, so every store moved to it was dead and new consumers attached to the unmounted root without any warning. The previous root now takes over again, and with no root left new consumers get the "no AutoRootCtx" error.
- Hydration no longer mismatches when a store has already published on the client. Consumers read the live store data during hydration, so an island, or a Suspense boundary of a streamed page, hydrating after the store had run for an earlier one rendered the live values against server HTML made from `initialState`, and React threw away the server HTML ("Hydration failed"). While hydrating, `useStore`, selectors and `useStoreSuspense` now render the store's `initialState` when the live data differs from it, then update. A component hydrating before its store ran renders no extra time.
- `getStore().subscribe` and `subscribeAll` listeners no longer see half-applied updates. A store published its keys one by one and notified after each, so a listener saw `price` new next to `total` still old. A store now publishes all changed keys of a render first, then notifies once per key with the complete state.
- `useStoreSuspense` suspends only on first load. After it had resolved, the `isReady` predicate was re-checked only when a key the component read changed at the same time: a refetch setting `isLoading` alone left the content, the same refetch together with new data replaced it with the fallback. Once a component has rendered an instance ready it now never suspends on it again; new params still do.
- TypeScript: store state and params can be declared with `interface`. The constraints were `Record<string, unknown>` and `Record<string, primitive>`, which interfaces do not satisfy (they have no index signature), so `createStore('x', (p: Params): State => ...)` failed with "Property ... is missing in type 'ParamsToIdRecord'". State is now any object type, and params any object type whose values are primitives (`StoreParamsShape`); object-valued params are still rejected.
- The published package is no longer compiled by the React Compiler. Since 1.0.27 the library build ran `babel-plugin-react-compiler`, which was meant for the examples only, so the package differed from the tested source. In 1.2.2 to 1.2.6 the compiler cached the `useStore()` proxy, undoing the 1.2.2 fix: in an app using the React Compiler, a helper called with the whole store object (`describe(store)`) kept its cached result and stopped updating. Tests and benchmarks always ran on the uncompiled source, which is now what ships.

### Added
- A development error when a second `AutoRootCtx` mounts in the same scope.
- A development error when the `Wrapper` passed to `AutoRootCtx` or `StateScopeProvider` changes identity, which happens when it is written inline: every store under it is remounted and loses its state. Likewise for a `debugging` renderer, which makes every store hook run again. The error handling guide and API pages showed the inline form; they now define the Wrapper at module scope.
- Types `StoreParamsShape<Params>` and `ParamValue`.
- `Context.publishMany(entries, removed?)`: publish several keys as one update. `Context.touch(keys)`: notify subscribers of keys whose value is unchanged (a store function with a new implementation).
- `useQuickSubscribe(ctx, serverData?)` and `useDataSelector(ctx, selector, isEqual?, serverData?)`: what the server rendered, used while hydrating.
- `getStore(params).error`: what the store hook threw while the instance is disabled, `undefined` while it runs. `Context` gains `failed`, `error`, `fail()`, `recover()` and `onStatus()`.

### Performance
- A store render costs less per key. The hook's result was copied for `preState` on every render, copied again to wrap functions, turned into an entries array, flattened and compared, then published key by key. It is now published in one pass at commit, `preState` is read once on mount, and only `function`s and classes have their source text checked. Updating one key of a store with 1000 keys and one consumer: ~0.21 ms → ~0.08 ms; with 10 000 keys: ~7.2 ms → ~3.7 ms, of which ~2.6 ms is the hook's own object spreads (jsdom). The standard benchmarks are unchanged within noise.

### Changed
- `preState` is read once when the instance mounts instead of being re-copied on every render.
- A store function wrapper forwards to the implementation of the latest committed render, not the latest render: a render React discards no longer leaks its closures into the wrapper.
- CI type-checks the library, the new type-level tests (`tests/types`) and the benchmarks (`yarn typecheck`); it ran no type check before.
- CI builds the package and runs the React Compiler tests against `dist/` (`yarn test:dist`), and fails if the build contains compiler output. The publish workflow does the same before publishing.

## [1.2.6] - 2026-10-03
### Fixed
- Store identity: a param passed as `undefined` no longer creates a separate instance. `useStore({ id, page: undefined })` and `useStore({ id })` now share one instance, so an optional param passed straight through no longer runs the hook twice.
- Store identity: values of different types no longer collide. `{ id: 1 }` and `{ id: '1' }`, or `null` and `'null'`, were one instance whose hook saw whichever params mounted first. A string that reads like a number, bigint, boolean or `null` is now quoted in the id (`id='1'`) and a bigint ends in `n`. Ids of ordinary strings and numbers are unchanged; keys shown by the dev tool and `debugging` change only for those quoted strings.

### Performance
- `AutoRootCtx` keeps reference counts and `timeToClean` timers out of React state. A consumer mounting or unmounting on an instance that is already running no longer re-renders anything: with 5000 instances, ~17.6 ms → ~0.1 ms per consumer in jsdom.
- Running instances are spread over 64 buckets, each rendering its own share. Starting or stopping an instance re-renders only its bucket instead of a list of every instance (React diffs a component's whole child list): with 5000 instances, ~18 ms → ~0.9 ms per instance, and mounting 5000 instances at once ~2.1 s → ~0.4 s in jsdom.

### Changed
- SSR guide: says plainly that a store cannot be seeded from server data, and lists what works instead.
- Docs on update cost: stores commit before their consumers, every component renders once per change (StrictMode doubles render calls, not commits), and frame time is decided by the DOM, not the store.

## [1.2.5] - 2026-10-03
### Changed
- npm keywords describe the library (global state, store, derived state, Suspense) instead of generic terms.

## [1.2.4] - 2026-10-03
### Fixed
- `useStoreSuspense`: the store retained while a component was suspended was released 100 ms after the promise resolved, but React reveals a resolved boundary 300 ms (React 19) or 500 ms (React 18) after its fallback. The store was torn down before the component committed, so the commit mounted a fresh instance, refetched and showed the fallback again. The retain now lasts until a component reading the store commits, with a one-second safety release for renders that never commit. Tests run on React's real scheduler, which `act()` hid.

### Added
- A development error when two different stores share a name. They shared one instance silently, with only one of the hooks running.

### Changed
- README, docs home and introduction lead with sharing: a hook written once runs once per params for every caller, composes with other stores and renders progressively. The 30-second example is now a ticker store and a position store reading it. The npm description follows.
- README: the comparison section now sets the library next to Jotai with the same order-book example (hook versus atom), a table of what differs, and one paragraph on Zustand, Redux and React context.
- Docs: new guide page Progressive data (one store per fetched source, a combining store the view renders from, switching params, `timeToClean` as a cache, use with TanStack Query). Limitations now state that layers are one commit apart, that store hooks see the providers above `AutoRootCtx` and that transitions stop at the store; the Suspense page documents switching params in `startTransition`; Reads outside render notes that a passed proxy is tracked only during render.

## [1.2.3] - 2026-10-03
### Fixed
- Dev tool: the inspector panel and its toggle button now have a `z-index` (`--rs-z-index`, default 9999), so page content no longer paints over them when the page scrolls. The store list hides the internal `auto-ctx` entry of scoped roots too, not only the global one.
- Dev tool: `react-state-custom/style.css` no longer sets `color-scheme` on `:root` (it flipped the host page's form controls and scrollbars to dark on a dark OS); the scheme and the text color are scoped to the panel, which also sets its own text color so it stays readable on dark host pages. The full-viewport overlay that stayed mounted while the panel was closed, with an invisible split bar still catching clicks along the bottom edge, is gone: the panel is only mounted while open.
- Dev tool: the store list updates from a cache subscription instead of polling `cache.size` every 50 ms, so a store replaced by another in the same tick no longer leaves a stale list. A selected store that unmounts is marked `unmounted` instead of silently showing old data, and the view follows the new instance when the store mounts again.
- `debugging` on `AutoRootCtx` / `StateScopeProvider` was documented but rendered nothing. It now renders each store instance's state as `<pre data-store="<store>?<params>">`, or through a custom component (`debugging={MyRenderer}`).

### Added
- `react-state-custom/dev-tool/obj-view`: `ObjectDataView`, a dev tool renderer showing values as an expandable tree with [react-obj-view](https://github.com/vothanhdat/react-obj-view), now an optional peer dependency. `DevToolContainer` gains `defaultOpen` and `defaultHeight`, typed button props (`DevToolContainerProps`), a title bar to drag-resize the panel, and remembers its open state and sizes per tab. The list shows decoded params (`userId=42`), the number of keys, the scope of scoped stores, and each view has a header with params, scope, `initial`/`unmounted` badges and a close button.
- `formatState(value)` (main entry): the JSON formatter behind `debugging` and the default dev tool renderer. Keeps functions (`ƒ increment()`), `undefined`, `bigint`, symbols, `Map`/`Set` entries and marks circular references instead of throwing.
- `getContext.cache.subscribe(listener)`: the context cache is now an `ObservableMap` that notifies after every creation or eviction.
- Documentation site at https://vothanhdat.github.io/react-state-custom/docs/ (VitePress, `yarn docs:dev` / `yarn docs:build`): a guide split into pages (store options, params, composing, scopes, errors, selectors, Suspense, outside React, dev tools, SSR, React Compiler), new Testing and Limitations/FAQ pages, the API reference split per export, benchmarks and this changelog, with local search. Deployed next to the demo by the Pages workflow.

- Benchmarks: four scenarios next to the flat one, `yarn bench` runs them all. *Derived*: a summary computed from 10 keys that 1000 consumers read, updated so that the sum changes or stays the same. *Topology*: a root config store, 10 derived stores reading one threshold each, 1000 consumers; one threshold, every threshold, or a root key no derived store reads changes. *Shop*: config and items feeding 100 line stores, 10 checkouts and a summary, updated at an item's qty, `vat`, `theme` or `discount`. *Collection*: 200 items with 5 readers each, as top-level keys and as an array under one key. The report prints consumer renders, derive calls and the code size (tokens) of each adapter; `bench/README.md` has the tables and what they show (derivations computed once per update, no work at all for keys nobody reads, one extra commit per derived layer, Jotai fastest on time, Zustand and Jotai the least code).
- Demo: Composed Stores gains a summary store that reads both invoice stores (settings → invoice → summary).
- Demo: "Selectors and Suspense" (render counters show which consumers a selector spares; `useStoreSuspense` with a boundary) and "Outside React" (`getStore()` with `retain()`, `get()` and `subscribe()` from plain module code) examples. A "Dev tools" toggle in the header (off by default) shows the store inspector inside every example.

### Changed
- Dev tool: `@uiw/react-split` replaced by a small pointer-capture resize hook; `dev-tool.es.js` no longer bundles it and `style.css` drops its rules. The compare columns share the space equally instead of being individually resizable. `DevToolState`'s `Component` prop is now optional (defaults to `DataViewDefault`, like `StateView`).
- Demo: Form and Cart examples removed (same parameterised-instances pattern as Todo and Timer). Example views use a small shared stylesheet instead of inline styles, and the explanatory paragraph that duplicated each example's description is gone.
- README reduced to the pitch, quick start and links into the site. `API_DOCUMENTATION.md` is now a redirect; the reference sources are `docs/api/*.md`. AI_CONTEXT examples are typed and use `initialState`.
- Docs: a Collections section (items as an object keyed by id, not an array under one key), a "Many instances at once" section on composing stores without calling hooks in loops and on the commit cost of deep chains, and `initialState` presented as an option over the lazy default (read with `??` / `?.`) in the guide, FAQ, AI_CONTEXT and Copilot notes. The README comparison table says what "boilerplate" means.
- Docs fixes: `markReady` / `onReady` documented on `Context`, the unused `toggleButton` prop dropped from the dev-tool reference, snippets fixed to type-check (`user` narrowing, optional `items`), spreading the `useStore` proxy documented as subscribing to every key.

## [1.2.2] - 2026-10-02
### Fixed
- React Compiler: `useStore()` / `useQuickSubscribe` return a new proxy on every render. The compiler memoises work on the identity of its inputs, so with the previous long-lived proxy a helper called with the whole store object (`describe(store)`) kept its cached result and its reads stopped being tracked; the component never updated. Compiled components that destructure keys were unaffected.

### Added
- `yarn test:compiler`: the store APIs tested under `babel-plugin-react-compiler` (components and store hooks compiled), run in CI next to the main suite.
- `yarn bench`: microbenchmarks against Zustand, Jotai and a plain React context (update cost, mount cost, consumer renders per update) with results and caveats in `bench/README.md` and a summary in the README.

## [1.2.1] - 2026-10-02
### Changed
- `Context` notifies subscribers directly instead of through `EventTarget.dispatchEvent`. The browser (and jsdom) report a listener's exception to `window.onerror` and carry on, which hid React's "Maximum update depth exceeded" from the publisher: whether a divergent store cycle stopped depended on which subscriber happened to be notified first. Now every subscriber is still notified and the first error is rethrown to the publisher, so the error lands in the publishing store's effect and `StoreErrorBoundary` disables that store with a logged error, as a throwing subscriber surfaces at `dispatch` in Redux or `setState` in Zustand. Listeners passed to `subscribe`, `subscribeAll` or `getStore().subscribe` should therefore not throw.
- A consumer that mounts in the same pass as `AutoRootCtx` (the usual app-root case) now renders twice on the way to its first data instead of three times, and a consumer whose `initialState` already matches the first publish renders once. `useCtxState` no longer subscribes to the `auto-ctx` "subscribe" function during render; it picks it up inside its effect, which also re-attaches the store if `AutoRootCtx` is replaced. The `tests/render-count.test.tsx` suite pins these numbers.

## [1.2.0] - 2026-10-02
### Added
- `getStore(params)`: an imperative handle for code outside React. `get()` returns a plain snapshot, `subscribe(listener)` delivers every change with the changed key, `retain()` keeps the store running without any component (returns a release function), `ready` tells whether the hook has published. Global scope only.
- `useStore(params, selector, isEqual?)`: re-render only when the selected (possibly deep or derived) value changes. Backed by the new `useDataSelector(ctx, selector, isEqual?)` hook.
- `useStoreSuspense(params, isReady?)`: suspend until the store hook has published once, or until `isReady(state)` holds; returns the full state type. The store is retained while the component is suspended.
- `Context.ready` / `markReady()` / `onReady()` and `acquireContext(name)` (ref-counted, non-hook access to a context) for building such integrations.

## [1.1.2] - 2026-10-02
### Changed
- Demo: examples now run natively in the playground next to their source, with an "Edit on StackBlitz" button that opens a new tab. StackBlitz embeds no longer start on pages that are not cross-origin isolated, and isolating the page blocks StackBlitz's own relay frame (stackblitz/sdk#37, stackblitz/webcontainer-core#2045).

## [1.1.1] - 2026-10-02
### Changed
- Docs: README gains "How It Works", a consumer step in Quick Start and a guide for store options, params, composed stores, error handling and reads outside render. API reference now covers every export, including `StateScopeProvider`, `StoreErrorBoundary`, the `Store*` types and the low-level hooks.
- Demo: playground snippets and examples use `createStore` with an options object and `initialState`; new async-data, composed-stores and scoped-state examples; "React 19" wording replaced by React 18+.

## [1.1.0] - 2026-10-02
### Fixed
- `AutoRootCtx` no longer moves a store's record to the end of its state object on unsubscribe. The move re-ordered keyed children, and React StrictMode re-runs effects of re-placed fibers, which made consumers unsubscribe/resubscribe and re-order again: an infinite loop in development with two or more stores. Records keep their position and stores render in a stable sorted order.
- A divergent store cycle (`A = B + 1`, `B = A + 1`) now runs synchronously and is capped by React's own nested-update limit (reported through `reportError`), instead of spinning forever in the background through timers.
- Action functions returned from a store hook now keep a stable identity across store renders (each function key gets one wrapper that forwards to the latest closure). Consumers that destructure actions no longer re-render on unrelated key changes.
- All subscribe hooks (`useQuickSubscribe`, `useDataSubscribe`, `useDataSubscribeWithTransform`, `useDataSubscribeMultiple`, `useDataSubscribeMultipleWithDebounce`) are now built on `useSyncExternalStore`. Updates are delivered synchronously, in one commit, with no tearing between hooks and no stray `setTimeout` in render.
- Change detection uses `Object.is` everywhere; publishing `0` over `""` or `null` over `undefined` is no longer swallowed.
- `useDataContext` re-validates its instance on commit, so a context evicted between render and commit is restored (or the live instance adopted) instead of leaving two Contexts for one name. Eviction never deletes a different live instance.
- `paramsToId` URI-encodes keys and values, so `=`, `&` and `?` inside a value can no longer collide with another params object.
- `process.env.NODE_ENV` is read inside a try/catch; the ES build no longer throws in environments without a `process` global.
- Using a store without any `<AutoRootCtx />` / `<StateScopeProvider>` mounted now logs a `console.error` (dev only) after 1s instead of failing silently.
- Dev tool: `StateView` reads from the cache instead of creating contexts (no more resurrected stores), grouped list items have keys, `Object.groupBy`/`toSorted` replaced for wider runtime support, typing fixed.

### Added
- `createStore` / `createAutoCtx` accept an options object `{ timeToClean, AttachedComponent, initialState }`. A bare number is still accepted as `timeToClean`.
- `initialState` seeds a store's context before the first consumer render, so values are never `undefined` on first paint. Keys listed in `initialState` are typed as always present on the `useStore` result.
- `useStore()` / `useCtxState()` can be called without arguments when the store has no required params.
- Exported types `StoreOptions`, `StoreParams`, `StoreState`.
- SSR support clarified and tested: on the server `useDataContext` uses throwaway contexts instead of the shared cache (no per-request memory growth, no cross-request sharing); `renderToString` output equals the client's first render so hydration matches. README section on server-side rendering and `'use client'` note for Next.js.
- `StoreErrorBoundary`: the default `Wrapper` of `AutoRootCtx`. A store hook that throws is disabled and logged; every other store keeps running. Pass your own `Wrapper` to override.
- Keys that a store hook stops returning are now published as `undefined` and removed from the context data.

### Changed
- **Breaking:** the dev tool moved to its own entry. Import `DevToolContainer` from `react-state-custom/dev-tool` and the stylesheet from `react-state-custom/style.css`. The main entry no longer carries the dev-tool CSS or its UI dependency, and `@uiw/react-split` is no longer installed for consumers.
- **Breaking:** the UMD build is replaced by a CommonJS build (`dist/index.cjs`). `package.json` now has an `exports` map and `sideEffects`.
- Stores publish from `useLayoutEffect` (client) so consumers see the first values before paint instead of one frame later.
- `StateRunner` is memoized: a consumer mounting or unmounting no longer re-runs every other store's hook.
- `useQuickSubscribe(undefined)` now returns a proxy whose properties read as `undefined` instead of throwing at creation.
- Reading the `useStore` proxy outside render no longer throws. It returns the current value, is not tracked, and logs a one-time development warning. Symbol keys pass through untracked.
- Peer dependency relaxed to `react >=18` / `react-dom >=18` (nothing React 19 specific is used).
- Tests run under `<StrictMode>`.

### Removed
- Internal `useRegistryChecker` (dead code). `Context.registry` is kept but deprecated.
- The dev-only dependency graph forgets a store when its context is evicted, so it no longer grows unbounded.

## [1.0.33] - 2026-02-22
- Added `StateScopeProvider` component for isolated nested state — allows subtrees to mount their own independent store instance, preventing state leakage between siblings or nested consumers.
- Re-exported `StateScopeProvider` from the package entrypoint (`src/index.ts`).
- Rewrote README and API documentation for clarity and impact; fixed example imports and corrected `AutoRootCtx` usage docs.
- Added `AI_CONTEXT.md` with guidelines on preferred patterns and API usage for AI-assisted development.

## [1.0.32] - 2025-11-30
- Added `createStore` helper function to simplify store creation (combines `createRootCtx` and `createAutoCtx` into one step).
- Added `useStore` hook to the return value of `createAutoCtx` and `createStore` for easier, proxy-based state consumption.
- Added documentation for "Composing Stores" pattern (derived state).
- Added `preState` argument to `createRootCtx` hooks so roots can warm-start from previously published data when they remount (helps AutoRootCtx keep state continuity).
- Updated documentation to describe the new `useFn(props, preState)` signature and warm-start behavior.
- Implemented `DependencyTracker` for circular dependency detection; warns at runtime when two stores subscribe to each other in a cycle.

## [1.0.31] - 2025-11-25
- Last tagged release before this changelog was introduced (see git history for details).

[Unreleased]: https://github.com/vothanhdat/react-state-custom/compare/v1.9.0...HEAD
[1.9.0]: https://github.com/vothanhdat/react-state-custom/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/vothanhdat/react-state-custom/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/vothanhdat/react-state-custom/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/vothanhdat/react-state-custom/compare/v1.5.1...v1.6.0
[1.5.1]: https://github.com/vothanhdat/react-state-custom/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/vothanhdat/react-state-custom/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/vothanhdat/react-state-custom/compare/v1.3.2...v1.4.0
[1.3.2]: https://github.com/vothanhdat/react-state-custom/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/vothanhdat/react-state-custom/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/vothanhdat/react-state-custom/compare/v1.2.6...v1.3.0
[1.2.6]: https://github.com/vothanhdat/react-state-custom/compare/v1.2.5...v1.2.6
[1.2.5]: https://github.com/vothanhdat/react-state-custom/compare/v1.2.4...v1.2.5
[1.2.4]: https://github.com/vothanhdat/react-state-custom/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/vothanhdat/react-state-custom/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/vothanhdat/react-state-custom/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/vothanhdat/react-state-custom/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/vothanhdat/react-state-custom/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/vothanhdat/react-state-custom/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/vothanhdat/react-state-custom/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.33...v1.1.0
[1.0.33]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.32...v1.0.33
[1.0.32]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.31...v1.0.32
[1.0.31]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.29...v1.0.31
