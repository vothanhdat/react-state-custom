# Suspense

`useStoreSuspense` suspends until the store hook has run once, or until an `isReady` predicate holds, and returns the full state type with nothing `undefined`.

```tsx
import { Suspense } from 'react'

const { useStoreSuspense: useUserStoreSuspense } = createStore('user', useUserState, {
  initialState: { user: null, isLoading: true },
})

function Profile({ userId }: { userId: string }) {
  const { user } = useUserStoreSuspense({ userId }, s => !s.isLoading)
  return <h1>{user!.name}</h1>
}

<Suspense fallback={<Spinner />}>
  <Profile userId="42" />
</Suspense>
```

## Behaviour

- **Without a predicate**, the component suspends until the hook has published at least once. Keys are then typed as present, which matches a hook whose return value is complete after its first run. A hook that fetches publishes on its first run, before the response arrives: give it a predicate such as `s => !s.isLoading`, or the component resumes with the data still missing.
- **With a predicate**, readiness is the predicate alone, evaluated against `initialState` merged with the live data. A seed that already satisfies it resolves immediately without suspending. Components reading the same instance with different predicates each wait for their own: one waiting for `s => s.user` renders as soon as the user is there, while another waits for `s => s.feed`.
- **Only the first load suspends.** Once a component has rendered an instance ready, it never suspends on it again, even if the predicate turns false later (a refetch setting `isLoading`): replacing content already on screen with the fallback, in an update no transition can hold, is rarely wanted. Show a refresh indicator from the state instead. New params are a new instance and suspend again (or, inside `startTransition`, keep the previous content until ready).
- **The store starts while the component is suspended**, so every `useStoreSuspense` in a boundary starts its store at once. A component of the same boundary that reads with `useStore` starts its store only once the boundary commits; see [Load in parallel](/guide/concurrent#load-in-parallel).
- **The store keeps running while the component is suspended.** React discards a suspended component's state, so the store is retained imperatively. The retain lasts until a component reading the store commits, which can be well after the promise resolves: React throttles revealing a boundary that showed its fallback (300 ms in React 19). A resolved render that never commits releases it after a second.
- **A component that goes away while suspended releases its store within about six seconds.** It never committed, so React reports nothing when it goes: every 5 seconds the wait wakes its components, and those still there render, are still not ready and wait again, on the same running instance. Until then the store keeps running, fetches and subscriptions included.
- After it resolves, the component is subscribed through the same tracking proxy as `useStore`: it re-renders only when a key it reads changes.
- **If the store hook throws**, before its first result or later, the component throws that error into its nearest error boundary. See [Error handling](/guide/error-handling#errors-in-consumers).
- **On the server** it throws unless `initialState` already satisfies `isReady`. Keep it inside a client-only boundary, or give it a seed that passes.

## Choosing between `isLoading` and Suspense

```tsx
// explicit
const { user, isLoading } = useUserStore({ userId })
if (isLoading) return <Spinner />

// Suspense
const { user } = useUserStoreSuspense({ userId }, s => !s.isLoading)
```

Both are supported. Suspense moves the loading state up to the nearest boundary and composes with `startTransition`, lazy components and streaming SSR. The explicit form keeps everything local and works on the server without a boundary.

## Transitions

**Switching params.** Change the params inside `startTransition` and React keeps the current content on screen until the new instance is ready, instead of showing the fallback:

```tsx
const [userId, setUserId] = useState('42')
const [isPending, startTransition] = useTransition()

const select = (id: string) => startTransition(() => setUserId(id))

<Suspense fallback={<Spinner />}>
  <Profile userId={userId} />   {/* keeps showing user 42 until the next user is ready */}
</Suspense>
```

The new instance mounts and fetches while the transition is pending; the old one is torn down once nothing reads it.

**Calling a store action inside a transition** marks the store's own render as a transition, not its consumers'. They render in the regular commit that follows the store's publish, so `isPending` turns `false` one commit before they show the new value, and a consumer that suspends on that value shows its fallback. Use transitions around component state, such as the params above, rather than around store actions, and [`useDeferredValue`](/guide/concurrent#keep-input-responsive-with-usedeferredvalue) to keep input responsive while consumers update.

## Store hooks that suspend

A store hook may itself suspend, for example with `use(promise)` or a suspense query hook. Each store runs inside its own `<Suspense fallback={null}>`, so only that store waits; the rest of the app and every other store keep running.

- **Before its first result**, the store has published nothing: `useStore` consumers read `initialState` or `undefined`, and `useStoreSuspense` consumers show their own boundary's fallback until it resumes.
- **When it suspends again on an update**, consumers keep the last published values until the hook resumes and publishes the new ones.
- React throttles revealing a boundary that showed its fallback, so the first result of a store that suspended on mount reaches consumers up to about 300 ms after it resolved.

Prefer hooks that return a loading state (`useQuery` rather than `useSuspenseQuery`) inside stores and publish `isLoading`: consumers then choose between a spinner and `useStoreSuspense`, and nothing is throttled.
