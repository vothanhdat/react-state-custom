# AutoRootCtx

The global manager component. Mount it once near the top of the application; it runs every store hook on demand and renders nothing visible. A second `AutoRootCtx` logs a development error: the stores move to the newest one, and back to the previous one when it unmounts, losing their state each time.

```tsx
function App() {
  return (
    <>
      <AutoRootCtx />
      <Routes />
    </>
  )
}
```

Each store instance runs inside its own error boundary: a store hook that throws is disabled and logged, and every other store keeps running. See [Error handling](/guide/error-handling).

## Deprecated props

Both are removed in 2.0. See [Migrating to 2.0](/guide/migrating-to-2).

```ts
function AutoRootCtx(props: {
  Wrapper?: React.ComponentType<{ children?: React.ReactNode }>
  debugging?: boolean | StateDebugRenderer
}): JSX.Element

type StateDebugRenderer = React.ComponentType<{ name: string; value: Record<string, unknown> }>
```

### `Wrapper`

Instead: report errors with React's `onCaughtError` root option, which receives every error a boundary caught.

A component rendered around each store instance. Defaults to [`StoreErrorBoundary`](/api/store-error-boundary). Pass your own error boundary to report errors or render a fallback. See [Error handling](/guide/error-handling). Define it at module scope: a new component type (an inline arrow function) remounts every store and loses their state, and logs a development error.

### `debugging`

Instead: the [dev tool](/api/dev-tools).

Default `false`. With `true`, every store instance renders its state next to where its hook runs, as `<pre data-store="<store>?<params>">` containing the JSON produced by [`formatState`](/api/primitives#formatstate) (functions included, as `ƒ name()`). Handy in tests, where the DOM can be queried by store key, and when the dev-tool bundle is not wanted. Pass a component instead to render `{ name, value }` yourself, defined at module scope: a new one re-runs every store hook. See [Developer tools](/guide/devtools#debugging-without-the-ui).

## Behaviour

- A store instance is mounted when the first `useStore` (or `retain()`) for its identity appears, and unmounted `timeToClean` milliseconds after the last one leaves.
- Instances render in a stable sorted order, each under its own `Wrapper`, so one store's error does not affect the others.
- Mounting or unmounting a consumer does not re-run other stores' hooks.
- Using a store while no `AutoRootCtx` is mounted logs a `console.error` in development after one second.
- If `AutoRootCtx` is unmounted and a new one mounted, readers re-attach their stores to the new root. Remounting it (with a new `key`) is how to start every store afresh.
