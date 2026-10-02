# Changelog

All notable changes to this project are documented here.

## [Unreleased]

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

[Unreleased]: https://github.com/vothanhdat/react-state-custom/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/vothanhdat/react-state-custom/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.33...v1.1.0
[1.0.33]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.32...v1.0.33
[1.0.32]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.31...v1.0.32
[1.0.31]: https://github.com/vothanhdat/react-state-custom/compare/v1.0.29...v1.0.31
