# Server-side rendering

`react-state-custom` is a **client-side** state manager that is **SSR-safe**. Stores are hooks that run inside `AutoRootCtx` after mount, and effects never run on the server, so:

- On the server, `useStore` returns `{}`: every key is `undefined`, as on the first client render, and `useMultipleStore` returns `{}` for each ref. No store hook runs, nothing is fetched, nothing leaks between requests: server renders use throwaway contexts, never the shared cache.
- Hydration matches: while hydrating, a reader renders what the server rendered, even when the store has already published on the client, for example because an earlier island or an earlier Suspense boundary of a streamed page started it. React then re-renders it with the live values. Stores mount after hydration and readers update from there.
- With streaming (`renderToPipeableStream`) the same rule holds for every boundary, whenever it hydrates.

Write readers that render a loading state from `undefined`, and the server HTML shows that state:

```tsx
function UserName({ userId }: { userId: string }) {
  const { user, isLoading } = useUserStore({ userId })
  if (isLoading !== false) return <Spinner />   // undefined on the server and before the store runs
  return <span>{user?.name}</span>
}
```

In 1.x, the deprecated [`initialState`](/guide/store-options#initialstate) option still seeds what the server renders.

## Next.js App Router

Everything here is a hook, so `AutoRootCtx` and any component calling `useStore` must live in a `'use client'` module. A small client wrapper is enough:

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

## Server-fetched data

There is no way to seed a store from server-fetched data. A store hook receives only its params, which are primitives, and there is no per-request hydration API.

What works today:

- **Keep server data in props.** Fetch in a server component, pass the result down, and let stores own only client state such as selection, filters or live updates.
- **Fetch again on the client.** The store fetches after hydration and the server HTML shows the loading state. With a data-fetching library inside the store, prime its cache from the server render through that library's own hydration API (for TanStack Query, `HydrationBoundary`), and the store's first `useQuery` starts from that data instead of an empty cache.

## `storeRef` on the server

`get()` returns `{}` and `ready` is `false`; `subscribe` and `retain` are no-ops in effect because no store ever mounts. Do not keep module-level references to stores across requests; they hold nothing useful.

## Deprecated

`useStoreSuspense` throws on the server unless `initialState` already satisfies its `isReady` predicate. Both are removed in 2.0.
