# Suspense

::: warning Deprecated
`useStoreSuspense` is removed in 2.0, with `initialState`. Stores keep their loading state in their values (`isLoading`, data `undefined` until it arrives), so a component renders its fallback itself:

```tsx
const { user, isLoading } = useUserStore({ userId })
if (isLoading !== false || !user) return <Spinner />   // undefined until the store has run once
return <h1>{user.name}</h1>
```

A store hook may still use a Suspense-based library inside it; see [Store hooks that suspend](#store-hooks-that-suspend). This page documents the 1.x API. See [Migrating to 2.0](/guide/migrating-to-2#suspense).
:::

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
- **With a predicate**, readiness is the predicate alone, evaluated against `initialState` merged with the live data. A seed that already satisfies it resolves immediately without suspending. That render comes before the store has run, so only the seeded keys exist, whatever the type says: seed every key the component reads (a no-op function for an action), check it in the predicate, or list the keys instead (below). In development a warning names a key such a render read while the seed lacked it. Components reading the same instance with different predicates each wait for their own: one waiting for `s => s.user` renders as soon as the user is there, while another waits for `s => s.feed`.
- **With a list of keys**, `useStoreSuspense(params, ['user', 'save'])`, readiness is every listed key holding a value: seeded or published, `null` included, not `undefined`. Those keys are typed as present and the others stay as optional as with `useStore`, so the type promises only what the render gets. See [Waiting for keys](#waiting-for-keys).
- **Only the first load suspends.** Once a component has rendered an instance ready, it never suspends on it again, even if the predicate turns false later (a refetch setting `isLoading`): replacing content already on screen with the fallback, in an update no transition can hold, is rarely wanted. Show a refresh indicator from the state instead. New params are a new instance and suspend again (or, inside `startTransition`, keep the previous content until ready).
- **The store starts while the component is suspended**, so every `useStoreSuspense` in a boundary starts its store at once. A component of the same boundary that reads with `useStore` starts its store only once the boundary commits; see [Load in parallel](/guide/concurrent#load-in-parallel).
- **The store keeps running while the component is suspended.** React discards a suspended component's state, so the store is retained imperatively. The retain lasts until a component reading the store commits, which can be well after the promise resolves: React throttles revealing a boundary that showed its fallback (300 ms in React 19). A resolved render that never commits releases it after a second.
- **A component that goes away while suspended releases its store within about six seconds.** It never committed, so React reports nothing when it goes: every 5 seconds the wait wakes its components, and those still there render, are still not ready and wait again, on the same running instance. Until then the store keeps running, fetches and subscriptions included.
- After it resolves, the component is subscribed through the same tracking proxy as `useStore`: it re-renders only when a key it reads changes.
- **If the store hook throws**, before its first result or later, the component throws that error into its nearest error boundary. See [Error handling](/guide/error-handling#a-store-that-throws).
- **On the server** it throws unless `initialState` already satisfies `isReady`. Keep it inside a client-only boundary, or give it a seed that passes.

## Waiting for keys

A predicate can hold on `initialState` alone, before the store has run, and that render then reads only the seeded keys although the result is typed as the full state. List the keys the component needs instead, and the type matches what it gets:

```tsx
const { useStoreSuspense: useCartSuspense } = createStore('cart', useCartState, {
  initialState: { loaded: true, owner: null },
})

function Cart() {
  const { items, add, owner } = useCartSuspense(undefined, ['items', 'add'])
  // items: Item[] and add: (item: Item) => void, waited for
  // owner: string | null, seeded
  // any other key: optional, as with useStore
  return <List items={items} onAdd={add} />
}
```

- A seed that holds every listed key renders at once, without the fallback. A key the seed lacks is waited for, so no render sees it `undefined`.
- It fits stores whose values stay `undefined` until they arrive (see [Progressive data](/guide/progressive-data)): listing a key waits for that value. For a condition on values, such as `s => !s.isLoading`, use a predicate.
- List the keys in the call, or keep them in a variable `as const`. A widened array, such as `const keys: (keyof Cart)[]`, does not say which keys it holds, so the result is typed as with `useStore`; it still waits for every key in it.
- Like every form, it suspends on the first load only. A store that later sets a listed key back to `undefined` hands the component `undefined` typed as present; in development a warning names the key. Keep the last value while reloading, with a loading flag.

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
