# Error handling

Each store instance runs inside its own error boundary. If a store hook throws, during render or in an effect, the boundary catches the error, logs it with `console.error`, and stops running that store. Every other store keeps running, and the components reading the failed one throw its error for their own error boundary.

## Expected failures are state

A request that fails, a socket that drops, a validation error: catch them in the hook and publish them, next to the data. The store keeps running, its readers render the failure, and a retry is an action of the store.

```ts
const useUserState = ({ userId }: { userId: string }) => {
  const [user, setUser] = useState<User>()
  const [error, setError] = useState<Error>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setError(undefined)
    fetchUser(userId).then(u => { if (!cancelled) setUser(u) }, e => { if (!cancelled) setError(e) })
    return () => { cancelled = true }
  }, [userId, attempt])
  return { user, error, isLoading: !user && !error, retry: () => setAttempt(a => a + 1) }
}
```

Work that can be retried retries in the store, in code: a store that crashed is not restarted.

## A store that throws

A hook that throws is a bug. The instance is disabled: its hook no longer runs, its actions do nothing, and every other store keeps running. The components reading it, through `useStore` (proxy or `select`) or `useMultipleStore`, throw its error during render, for their own error boundary: the failure shows where the store is used. A component that mounts after the failure throws at once, and a store whose hook reads the failed one fails with the same error.

Put error boundaries where a part of the screen can fail on its own, for example one per panel:

```tsx
import { ErrorBoundary } from 'react-error-boundary'

<ErrorBoundary fallbackRender={({ error, resetErrorBoundary }) => (
  <Panel>Could not load the orders: {error.message} <button onClick={resetErrorBoundary}>Retry</button></Panel>
)}>
  <OpenOrders />
</ErrorBoundary>
```

Without a boundary above the reader, the error reaches the root, as any error thrown in render does, and React unmounts the app.

## Reporting errors

React 19 hands every error an error boundary caught to the root's `onCaughtError`, the stores' boundaries included:

```tsx
createRoot(document.getElementById('root')!, {
  onCaughtError: (error, info) => reportError(error, info.componentStack),
}).render(<App />)
```

`storeRef(params).error` is what the hook threw while the instance is disabled, and `undefined` while it runs.

## Errors thrown by subscribers

Listeners registered with `storeRef(params).subscribe()` must not throw. When a listener throws, every other listener is still notified, then the first error is rethrown to the store that published the change. The publish happens in the store's layout effect, so the error reaches that store's boundary and disables it, the same way a throwing subscriber surfaces at `dispatch` in Redux or `setState` in Zustand.

## Recovery

A disabled store stays disabled until its instance is torn down: when its boundaries have unmounted the components that read it, and `timeToClean` has passed. A reader that mounts after that, such as the one a boundary's retry renders, starts a fresh instance. There is no in-place restart. If a store must recover without a remount, catch the error inside the hook and expose it as state, as above.
