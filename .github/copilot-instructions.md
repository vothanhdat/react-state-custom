# Copilot / AI instructions for react-state-custom

Read `AI_CONTEXT.md` first: it is the canonical guide for writing code with this library and is kept
up to date with every release. This file only adds repository-specific notes.

## Project snapshot
- Hook-first state management library. Public entry `src/index.ts`; schedulers entry `src/schedulers/index.ts`
  (`react-state-custom/schedulers`); testing entry `src/testing/index.ts`; dev tool entry `src/dev-tool/index.ts`
  (published as `react-state-custom/dev-tool` with `react-state-custom/style.css`), plus
  `src/dev-tool/obj-view.tsx` (`react-state-custom/dev-tool/obj-view`, the only code that imports the
  optional peer `react-obj-view`; keep it out of the other entries). The dev tool has no other dependency.
- Core lives in `src/state-utils/`: `ctx.ts` (Context pub/sub, subscribe/publish hooks),
  `createRootCtx.tsx` (headless Root component that runs a hook), `createAutoCtx.tsx`
  (`AutoRootCtx`, `createStore` with `useStore`/`storeRef`, and the deprecated `StateScopeProvider`,
  `StoreErrorBoundary`), `useMultipleStore.ts`, `useQuickSubscribe.ts` (render-time tracking proxy),
  `schedule.ts`/`schedulers.ts`, `storeRegistry.ts`, `paramsToId.tsx`, `utils.ts`.
- Peer dependency React >= 18. Builds ESM + CJS with Vite, types via vite-plugin-dts.
- Demo site: `src/playground` renders `src/examples/*` natively (GitHub Pages root) with an "Edit on StackBlitz"
  button; `src/dev` renders the same examples for local development (`yarn dev`).
- Docs site: VitePress in `docs/` (`yarn docs:dev`, `yarn docs:build`), deployed under `/react-state-custom/docs/`
  by the same Pages workflow. `docs/changelog.md` and `docs/benchmarks.md` include `CHANGELOG.md` and
  `bench/README.md`; `API_DOCUMENTATION.md` is a redirect, the reference lives in `docs/api/`.

## Golden path (what generated code should use)
- The 2.0 API, available from 1.10: `createStore(name, useFn, { timeToClean?, schedule? })` returns
  `{ useStore, storeRef }`; `useMultipleStore(refs, options?)`; `<AutoRootCtx />` mounted once at the root.
  Everything else exported is `@deprecated` in 1.10 and removed in 2.0; do not use it in new code, demos or docs.
- `useStore(params?)` returns the proxy: destructure during render; it tracks reads and is a new object every render
  (React Compiler safe). `useStore(params, { select, isEqual?, schedule? })` selects, `shallowEqual` by default.
- Params are primitives only (`paramsToId` throws otherwise). Same params = shared instance.
- Stores are lazy: values are `undefined` until the hook has run, by design. Read with `??`/`?.`, call actions with `?.()`.
- Values from two stores can disagree for one render (a store publishes one commit after the stores it reads): check before reading, join by id, keep decisions that need several stores in one store.

## Internals worth knowing when editing the core
- `Context.publish` uses `Object.is`; subscribe hooks are built on `useSyncExternalStore`.
- Roots publish from a layout effect (`useIsomorphicLayoutEffect`), so first values land before paint.
- `AutoRootCtx` keeps a record per store instance keyed by context name. Never reorder those keys:
  React StrictMode re-runs effects of re-placed fibers and the result is an infinite loop.
- Action functions returned by a store hook are wrapped once per key (`useStableActions`) so their identity is stable.
- `useDataContext` returns a throwaway `Context` on the server (`isServer()`), never the shared cache.
- `DependencyTracker` (dev only) warns on store cycles and forgets a store when its context is evicted.

## Working in this repo
- Yarn 4 (`corepack enable`), CI runs `yarn install --immutable`: run `yarn install` after changing dependencies.
- Tests: `yarn test` (Vitest, jsdom, StrictMode on; `tests/setup.ts` calls `resetStores()` from `src/testing` after each test). Add tests under `tests/` for every behavior change.
- Releases: bump `package.json` + `CHANGELOG.md`, tag `vX.Y.Z`, push the tag. `publish.yml` publishes to npm
  via trusted publishing; `deploy.yml` deploys the demo and the docs on every push to `master`.
