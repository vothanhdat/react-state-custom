# AutoRootCtx

The global manager component. Mount it once near the top of the application; it runs every store hook on demand and renders nothing visible.

```ts
function AutoRootCtx(props: {
  Wrapper?: React.ComponentType<{ children?: React.ReactNode }>
  debugging?: boolean
}): JSX.Element
```

## Props

### `Wrapper`

A component rendered around each store instance. Defaults to [`StoreErrorBoundary`](/api/store-error-boundary). Pass your own error boundary to report errors or render a fallback. See [Error handling](/guide/error-handling).

### `debugging`

When `true`, renders a raw text view of the mounted stores in the DOM. Default `false`.

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
