# Changelog

All notable changes to this project are documented here.

## [Unreleased]
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

- Demo: Composed Stores gains a summary store that reads both invoice stores (settings → invoice → summary).
- Demo: "Selectors and Suspense" (render counters show which consumers a selector spares; `useStoreSuspense` with a boundary) and "Outside React" (`getStore()` with `retain()`, `get()` and `subscribe()` from plain module code) examples. A "Dev tools" toggle in the header (off by default) shows the store inspector inside every example.

### Changed
- Dev tool: `@uiw/react-split` replaced by a small pointer-capture resize hook; `dev-tool.es.js` no longer bundles it and `style.css` drops its rules. The compare columns share the space equally instead of being individually resizable. `DevToolState`'s `Component` prop is now optional (defaults to `DataViewDefault`, like `StateView`).
- Demo: Form and Cart examples removed (same parameterised-instances pattern as Todo and Timer). Example views use a small shared stylesheet instead of inline styles, and the explanatory paragraph that duplicated each example's description is gone.
- README reduced to the pitch, quick start and links into the site. `API_DOCUMENTATION.md` is now a redirect; the reference sources are `docs/api/*.md`. AI_CONTEXT examples are typed and use `initialState`.
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

[Unreleased]: https://github.com/vothanhdat/react-state-custom/compare/v1.2.2...HEAD
[1.2.2]: https://github.com/vothanhdat/react-state-custom/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/vothanhdat/react-state-custom/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/vothanhdat/react-state-custom/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/vothanhdat/react-state-custom/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/vothanhdat/react-state-custom/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.33...v1.1.0
[1.0.33]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.32...v1.0.33
[1.0.32]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.31...v1.0.32
[1.0.31]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.29...v1.0.31
