# Error handling

Each store instance is wrapped in `StoreErrorBoundary` by default. If a store hook throws, during render or in an effect, the boundary catches the error, logs it with `console.error`, and stops rendering that store. Every other store and the UI keep running. Consumers of the failed store keep reading its last published values.

## Errors in consumers

- `useStoreSuspense` throws the store's error into the consumer's own error boundary, whether the hook failed before its first result or later. A component waiting in a `<Suspense>` boundary therefore never waits forever on a store that crashed.
- `useStore` keeps returning the last published values, as above: a store that failed before its first result keeps showing `initialState`, a loading flag included. Read `useStoreStatus(params)` next to it to render the failure.
- `useStoreStatus(params)` returns `{ ready, failed, error }` for the instance and re-renders only when that changes. It works in a `StateScopeProvider` and inside another store, which can then publish the failure of a store it reads.
- `getStore(params).error` is what the hook threw while the instance is disabled, and `undefined` while it runs.

```tsx
const { useStore: useUser, useStoreStatus: useUserStatus } = createStore('user', useUserState, {
  initialState: { user: null, isLoading: true },
})

function Profile({ userId }: { userId: string }) {
  const { user, isLoading } = useUser({ userId })
  const { failed, error } = useUserStatus({ userId })
  if (failed) return <ErrorPanel error={error} />  // instead of a spinner that never stops
  if (isLoading) return <Spinner />
  return <h1>{user!.name}</h1>
}
```

`useStoreStatus` reports a hook that crashed, a bug. Failures you expect, such as a request that fails, are better caught in the hook and published as state (see below): the store keeps running and can retry.

The `Wrapper` passed to `AutoRootCtx` still receives every error, so reporting keeps working.

## Reporting or rendering errors

Pass your own `Wrapper` to `AutoRootCtx` (or `StateScopeProvider`) to report errors or render a fallback. The wrapper receives `children`, the store component.

```tsx
import { ErrorBoundary } from 'react-error-boundary'

// Defined once at module scope: an inline component would be a new type on every render
// and remount every store, losing their state.
const ReportStoreErrors = ({ children }: { children?: React.ReactNode }) => (
  <ErrorBoundary fallback={null} onError={reportError}>
    {children}
  </ErrorBoundary>
)

<AutoRootCtx Wrapper={ReportStoreErrors} />
```

Never write the `Wrapper` inline (`Wrapper={({ children }) => ...}`): whenever the component that renders `AutoRootCtx` re-renders, the inline function is a new component type and React remounts every store under it. A development error is logged when that happens.

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
