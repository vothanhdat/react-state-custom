# AutoRootCtx

The component that runs every store. Mount it once near the top of the application; it takes no props, runs each store hook on demand and renders nothing visible. A second `AutoRootCtx` logs a development error: the stores move to the newest one, and back to the previous one when it unmounts, losing their state each time.

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

## Behaviour

- A store instance is mounted when the first `useStore`, `useMultipleStore` or `retain()` for its identity appears, and unmounted `timeToClean` milliseconds after the last one leaves.
- Each instance runs inside its own error boundary: a store hook that throws is disabled and logged, the components reading it throw its error, and every other store keeps running. See [Error handling](/guide/error-handling).
- Each instance also runs inside its own Suspense boundary: a store hook that suspends (`use(promise)`, a suspense query) never hides the app. Its readers see what it last published, `undefined` before that.
- Mounting or unmounting a reader of a running instance does not re-render `AutoRootCtx` or re-run other stores' hooks.
- Using a store while no `AutoRootCtx` is mounted logs a `console.error` in development after one second.
- If `AutoRootCtx` is unmounted and a new one mounted, readers re-attach their stores to the new root. Remounting it (with a new `key`) is how to start every store afresh.
