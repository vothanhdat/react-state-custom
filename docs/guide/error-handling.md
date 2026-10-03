# Error handling

Each store instance is wrapped in `StoreErrorBoundary` by default. If a store hook throws, during render or in an effect, the boundary catches the error, logs it with `console.error`, and stops rendering that store. Every other store and the UI keep running. Consumers of the failed store keep reading its last published values.

## Errors in consumers

- `useStoreSuspense` throws the store's error into the consumer's own error boundary, whether the hook failed before its first result or later. A component waiting in a `<Suspense>` boundary therefore never waits forever on a store that crashed.
- `useStore` keeps returning the last published values, as above. Expose an error as state from the hook (see below) when consumers should render it.
- `getStore(params).error` is what the hook threw while the instance is disabled, and `undefined` while it runs.

The `Wrapper` passed to `AutoRootCtx` still receives every error, so reporting keeps working.

## Reporting or rendering errors

Pass your own `Wrapper` to `AutoRootCtx` (or `StateScopeProvider`) to report errors or render a fallback. The wrapper receives `children`, the store component.

```tsx
import { ErrorBoundary } from 'react-error-boundary'

<AutoRootCtx
  Wrapper={({ children }) => (
    <ErrorBoundary fallback={null} onError={reportError}>
      {children}
    </ErrorBoundary>
  )}
/>
```

A wrapper that renders a visible fallback will render it where `AutoRootCtx` sits in the tree. Keep store fallbacks invisible and show error state through the store's own values instead:

```ts
const useUserState = ({ userId }: { userId: string }) => {
  const [state, setState] = useState<{ user?: User; error?: Error }>({})
  useEffect(() => {
    fetchUser(userId).then(user => setState({ user })).catch(error => setState({ error }))
  }, [userId])
  return state
}
```

## Errors thrown by subscribers

Listeners registered with `getStore().subscribe()`, `Context.subscribe()` or `Context.subscribeAll()` must not throw. When a listener throws, every other listener is still notified, then the first error is rethrown to the store that published the change. The publish happens in the store's layout effect, so the error reaches that store's boundary and disables it, the same way a throwing subscriber surfaces at `dispatch` in Redux or `setState` in Zustand.

## Recovery

A disabled store stays disabled until its instance is torn down and mounted again: when the last consumer unmounts (after `timeToClean`) and a new consumer appears. There is no in-place retry. A `useStoreSuspense` consumer that suspended keeps the instance alive for about a second after it gave up, so a retry right away shows the same error; a retry after that starts a fresh instance. If a store must recover without a remount, catch the error inside the hook and expose it as state, as above.
