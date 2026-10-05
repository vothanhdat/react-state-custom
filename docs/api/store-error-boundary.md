# StoreErrorBoundary

::: warning Deprecated
Removed from the exports in 2.0, with the `Wrapper` prop of `AutoRootCtx`. Each store keeps its own boundary; report errors with React's `onCaughtError` root option. See [Error handling](/guide/error-handling).
:::

The default `Wrapper` of `AutoRootCtx` and `StateScopeProvider`. When a store hook throws, the boundary catches the error, logs it with `console.error`, and stops rendering that store. Other stores and the application keep working. Consumers of the failed store keep reading its last published values.

```ts
class StoreErrorBoundary extends React.Component<{ children?: React.ReactNode }> {}
```

It renders `null` after an error and has no props besides `children`. To report errors or customise the behaviour, pass your own boundary as `Wrapper`:

```tsx
import { ErrorBoundary } from 'react-error-boundary'

// at module scope: an inline Wrapper is a new component type on every render and remounts every store
const ReportStoreErrors = ({ children }: { children?: React.ReactNode }) => (
  <ErrorBoundary fallback={null} onError={reportError}>{children}</ErrorBoundary>
)

<AutoRootCtx Wrapper={ReportStoreErrors} />
```

Errors thrown by subscribers during a publish are rethrown to the publishing store and land in this boundary too. See [Error handling](/guide/error-handling).
