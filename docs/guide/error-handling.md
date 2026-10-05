# Error handling

Each store instance runs inside its own error boundary. If a store hook throws, during render or in an effect, the boundary catches the error, logs it with `console.error`, and stops running that store. Every other store and the UI keep running.

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

A hook that throws is a bug. In 1.x, the failed store's readers keep reading its last published values, and its actions do nothing: the hook that defined them no longer runs. A store that failed before its first result leaves its readers on `undefined`, the loading state.

From 2.0, the components reading a failed store throw its error, for their own error boundary: the failure shows where the store is used, and every other store keeps running.

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

A disabled store stays disabled until its instance is torn down and mounted again: when the last reader unmounts (after `timeToClean`) and a new reader appears. There is no in-place restart. If a store must recover without a remount, catch the error inside the hook and expose it as state, as above.

## Deprecated

These keep working in 1.x and are removed in 2.0. See [Migrating to 2.0](/guide/migrating-to-2).

- **`useStoreStatus(params)`** returns `{ ready, failed, error }` for the instance and re-renders only when that changes. Instead, keep loading state in the store; from 2.0 a failed store throws in its readers.
- **`useStoreSuspense`** throws the store's error into the reader's error boundary, as every reader does from 2.0.
- **The `Wrapper` prop** of `AutoRootCtx` (and `StateScopeProvider`) replaces `StoreErrorBoundary` around each store, to report errors or render a fallback. Define it at module scope: an inline component is a new type on every render and remounts every store. Instead, report errors with `onCaughtError`.
