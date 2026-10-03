# Server-side rendering

`react-state-custom` is a **client-side** state manager that is **SSR-safe**. Stores are hooks that run inside `AutoRootCtx` after mount, and effects never run on the server, so:

- On the server, consumers render with `initialState` (or `undefined`). No store hook runs, nothing is fetched, nothing leaks between requests: server renders use throwaway contexts, never the shared cache.
- Hydration matches, because the client's first render reads the very same snapshot. Stores mount after hydration and consumers update from there.
- With streaming (`renderToPipeableStream`) the same rule holds: every boundary renders the same `initialState`.

Give stores an `initialState` so server HTML shows a meaningful loading state instead of empty values.

```ts
export const { useStore: useUserStore } = createStore('user', useUserState, {
  initialState: { user: null, isLoading: true },
})
```

## Next.js App Router

Everything here is a hook, so `AutoRootCtx`, `StateScopeProvider` and any component calling `useStore` must live in a `'use client'` module. A small client wrapper is enough:

```tsx
// app/providers.tsx
'use client'
import { AutoRootCtx } from 'react-state-custom'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AutoRootCtx />
      {children}
    </>
  )
}
```

```tsx
// app/layout.tsx (server component)
import { Providers } from './providers'

export default function RootLayout({ children }) {
  return <html><body><Providers>{children}</Providers></body></html>
}
```

Server components cannot call `useStore`. Fetch on the server and pass data down as props, or let a client component fetch through its store after hydration.

## Server-fetched data as initial state

`initialState` can be a function of the params, but it cannot read request data. To seed a store from server-fetched data, pass that data into the store hook as a param-independent prop through a client component, or keep the server data in props and let the store own only client state. There is no per-request store hydration API.

## `useStoreSuspense` on the server

It throws on the server unless `initialState` already satisfies its `isReady` predicate. Keep it inside a client-only boundary, or seed a state that passes the predicate.

## `getStore` on the server

`get()` returns `initialState` and `ready` is `false`; `subscribe` and `retain` are no-ops in effect because no store ever mounts. Do not keep module-level references to stores across requests; they hold nothing useful.
