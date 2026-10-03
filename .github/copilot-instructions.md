# Copilot / AI instructions for react-state-custom

Read `AI_CONTEXT.md` first: it is the canonical guide for writing code with this library and is kept
up to date with every release. This file only adds repository-specific notes.

## Project snapshot
- Hook-first state management library. Public entry `src/index.ts`; dev tool entry `src/dev-tool/index.ts`
  (published as `react-state-custom/dev-tool` with `react-state-custom/style.css`), plus
  `src/dev-tool/obj-view.tsx` (`react-state-custom/dev-tool/obj-view`, the only code that imports the
  optional peer `react-obj-view`; keep it out of the other entries). The dev tool has no other dependency.
- Core lives in `src/state-utils/`: `ctx.ts` (Context pub/sub, subscribe/publish hooks),
  `createRootCtx.tsx` (headless Root component that runs a hook), `createAutoCtx.tsx`
  (`AutoRootCtx`, `createStore`, `StateScopeProvider`, `StoreErrorBoundary`),
  `useQuickSubscribe.ts` (render-time tracking proxy), `paramsToId.tsx`, `utils.ts`.
- Peer dependency React >= 18. Builds ESM + CJS with Vite, types via vite-plugin-dts.
- Demo site: `src/playground` renders `src/examples/*` natively (GitHub Pages root) with an "Edit on StackBlitz"
  button; `src/dev` renders the same examples for local development (`yarn dev`).
- Docs site: VitePress in `docs/` (`yarn docs:dev`, `yarn docs:build`), deployed under `/react-state-custom/docs/`
  by the same Pages workflow. `docs/changelog.md` and `docs/benchmarks.md` include `CHANGELOG.md` and
  `bench/README.md`; `API_DOCUMENTATION.md` is a redirect, the reference lives in `docs/api/`.

## Golden path (what generated code should use)
- `createStore(name, useFn, options?)` where `options` is `{ timeToClean?, AttachedComponent?, initialState? }`.
- `useStore(params?)` from the result. Destructure during render; the proxy tracks reads and is a new object every render (React Compiler safe).
- `<AutoRootCtx />` mounted once at the root. `<StateScopeProvider>` for an isolated subtree.
- Params are primitives only (`paramsToId` throws otherwise). Same params = shared instance.
- Stores are lazy: values are `undefined` until the hook has run. Read with `??`/`?.`, or pass `initialState` for non-optional types, server HTML with values, or a single render on mount.

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
- Tests: `yarn test` (Vitest, jsdom, StrictMode on). Add tests under `tests/` for every behavior change.
- Releases: bump `package.json` + `CHANGELOG.md`, tag `vX.Y.Z`, push the tag. `publish.yml` publishes to npm
  via trusted publishing; `deploy.yml` deploys the demo and the docs on every push to `master`.
