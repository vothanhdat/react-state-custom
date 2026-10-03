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

- **Without a predicate**, the component suspends until the hook has published at least once. Keys are then typed as present, which matches a hook whose return value is complete after its first run.
- **With a predicate**, readiness is the predicate alone, evaluated against `initialState` merged with the live data. A seed that already satisfies it resolves immediately without suspending.
- **The store keeps running while the component is suspended.** React discards a suspended component's state, so the store is retained imperatively. The retain lasts until a component reading the store commits, which can be well after the promise resolves: React throttles revealing a boundary that showed its fallback (300 ms in React 19). A resolved render that never commits releases it after a second.
- After it resolves, the component is subscribed through the same tracking proxy as `useStore`: it re-renders only when a key it reads changes.
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

**Calling a store action inside a transition** marks the store's own render as a transition, not its consumers'. They render in the regular commit that follows the store's publish, so `isPending` turns `false` one commit before they show the new value, and a consumer that suspends on that value shows its fallback. Use transitions around component state, such as the params above, rather than around store actions.
