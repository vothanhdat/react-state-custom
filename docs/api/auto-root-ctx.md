# AutoRootCtx

The global manager component. Mount it once near the top of the application; it runs every store hook on demand and renders nothing visible.

```ts
function AutoRootCtx(props: {
  Wrapper?: React.ComponentType<{ children?: React.ReactNode }>
  debugging?: boolean | StateDebugRenderer
}): JSX.Element

type StateDebugRenderer = React.ComponentType<{ name: string; value: Record<string, unknown> }>
```

## Props

### `Wrapper`

A component rendered around each store instance. Defaults to [`StoreErrorBoundary`](/api/store-error-boundary). Pass your own error boundary to report errors or render a fallback. See [Error handling](/guide/error-handling).

### `debugging`

Default `false`. With `true`, every store instance renders its state next to where its hook runs, as `<pre data-store="<store>?<params>">` containing the JSON produced by [`formatState`](/api/primitives#formatstate) (functions included, as `ƒ name()`). Handy in tests, where the DOM can be queried by store key, and when the dev-tool bundle is not wanted. Pass a component instead to render `{ name, value }` yourself. See [Developer tools](/guide/devtools#debugging-without-the-ui).

## Behaviour

- A store instance is mounted when the first `useStore` (or `retain()`) for its identity appears, and unmounted `timeToClean` milliseconds after the last one leaves.
- Instances render in a stable sorted order, each under its own `Wrapper`, so one store's error does not affect the others.
- Mounting or unmounting a consumer does not re-run other stores' hooks.
- Using a store while no `AutoRootCtx` (or `StateScopeProvider`) is mounted logs a `console.error` in development after one second.
- If `AutoRootCtx` is unmounted and a new one mounted, consumers re-attach their stores to the new root.

## Example

```tsx
function App() {
  return (
    <>
      <AutoRootCtx Wrapper={MyErrorBoundary} />
      <Routes />
    </>
  )
}
```
