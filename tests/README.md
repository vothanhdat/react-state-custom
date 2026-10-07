# Tests

```bash
yarn test              # the suite, jsdom, every render under StrictMode
yarn test:compiler     # tests/compiler: stores and components compiled by the React Compiler
yarn build && yarn test:dist   # the same, against the built package
yarn test:package-types        # tests/package-types: an app's tsc against dist/, six module resolutions
yarn test:docs-code            # tests/docs-code: the ts/tsx blocks of the docs, the README and AI_CONTEXT.md against src/
yarn typecheck         # the library, tests/types, the benchmarks and both demos
```

CI also runs the suite on React 18.3 (`.github/workflows/test.yml`); tests that need React 19.2 (`<Activity>`) skip there.

## Layout

| Files | What they cover |
|---|---|
| `createStore`, `auto-root*`, `integration` | instances per params, sharing, `timeToClean`, several roots, buckets, store names |
| `minimal-api`, `store-ref`, `store-selector`, `store-functions`, `store-publish` | `useStore` and `{ select }`, `storeRef`, `useMultipleStore`, what a store publishes |
| `store-errors`, `teardown`, `hot-reload`, `store-hook-suspends` | a store that throws, a torn-down instance, hot updates, a hook that suspends |
| `concurrent`, `ssr.*` | transitions, `useDeferredValue`, `<Activity>`, server rendering and hydration |
| `schedule` | the `schedule` option and `react-state-custom/schedulers` |
| `testing` | `react-state-custom/testing` |
| `render-count`, `bulk-updates`, `node-env`, `production-bundle` | render counts, linear updates, development checks that cost nothing in production |
| `recipes` | the recipes of the guide, as written there |
| `ctx`, `useQuickSubscribe`, `review-fixes` | internals: the context, the tracking proxy, the context cache |
| `examples.smoke`, `dev-tool` | the playground examples and the dev tool |
| `types/` | type-level tests, checked by `yarn typecheck`, never run |

## Conventions

- `setup.ts` renders under StrictMode and calls `cleanup()` and `resetStores()` after each test. Pass `{ reactStrictMode: false }` to `render` where a test counts renders.
- Give each store a unique name: names identify instances across the whole page.
- Most tests wait with `act` and real timers (`tick`); tests of a schedule use fake timers or `flushScheduled()`.
