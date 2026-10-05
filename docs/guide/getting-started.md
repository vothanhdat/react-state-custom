# Getting started

## Install

```bash
npm install react-state-custom
# or
yarn add react-state-custom
```

React 18 or newer is required. `react` and `react-dom` are peer dependencies. The package ships ESM and CommonJS builds, each with TypeScript declarations that work under any `moduleResolution` (`bundler`, `node16`/`nodenext`, `node10`).

## 1. Define your state as a hook

Write a hook that returns the data and the actions you want to share.

```ts
// features/userState.ts
import { useState, useEffect } from 'react'

export type User = { id: string; name: string }

export const useUserState = ({ userId }: { userId: string }) => {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchUser(userId).then(u => { if (!cancelled) setUser(u) })
    return () => { cancelled = true }
  }, [userId])

  return { user, isLoading: !user }
}
```

Nothing here is specific to the library. The hook can use any other hook, including other stores.

## 2. Create the store

`createStore` registers the hook under a name and returns `useStore`, the hook components read it with, and `storeRef`, which reaches an instance from anywhere else.

```ts
// features/userStore.ts
import { createStore } from 'react-state-custom'
import { useUserState } from './userState'

export const { useStore: useUserStore, storeRef: userRef } = createStore('user', useUserState, {
  timeToClean: 10_000, // keep a user 10 s after its last reader leaves
})
```

Every option is optional. See [Store options](/guide/store-options).

## 3. Mount the root once

`AutoRootCtx` is the component that runs your store hooks. Mount it once near the top of the app.

```tsx
// App.tsx
import { AutoRootCtx } from 'react-state-custom'

export default function App() {
  return (
    <>
      <AutoRootCtx />
      <YourAppContent />
    </>
  )
}
```

No provider per store, no wrapping. `AutoRootCtx` renders nothing visible.

## 4. Read the store anywhere

Call the generated hook and destructure the keys you need during render.

```tsx
function UserName({ userId }: { userId: string }) {
  const { user } = useUserStore({ userId })
  if (!user) return <Spinner />
  return <span>{user.name}</span>
}
```

Two components rendering `useUserStore({ userId: '42' })` share one instance of the hook and therefore one fetch. `UserName` re-renders only when `user` changes, not when some other key of the store does.

## Before the data arrives

Stores are lazy: a store starts when its first reader mounts, so on that reader's first render the hook has not run yet. Every key is `undefined`, actions included, and nothing is ready at the start by design. Data from a fetch or a socket stays `undefined`, or the `null` you start it with, until it arrives. The types say so: every key of the `useStore` result is optional. Check values before using them.

```tsx
function TaskTitle({ projectId, id }: { projectId: string; id: string }) {
  const task = useTasks({ projectId }, { select: s => s.tasks?.[id] })
  if (!task) return null                 // not loaded yet, or just deleted
  return <span>{task.title}</span>
}

function Total() {
  const { total, checkout } = useCart()
  return <button onClick={() => checkout?.()}>{total ?? '…'}</button>
}
```

- **Data**: read with `?.`, fall back with `??`, or return a placeholder early.
- **Actions**: call them with `?.()` from event handlers. By the time anyone clicks, the store has run and the action exists. A call made while rendering, or from an effect when the component mounts, comes before the store has run and does nothing. Start loading inside the store, which runs its own effects. When an effect exists only to call an action, list the action as a dependency and return early while it is missing: the effect runs again once the action exists. Actions keep their identity while their instance runs, so it runs once more, not on every render. An instance that restarts has new actions, and the effect calls the new one.

  ```ts
  const { load } = useReport({ id })
  useEffect(() => {
    if (!load) return                    // the store has not run yet
    load(range)
  }, [load, range])
  ```

  Keep an action out of the dependencies of an effect that does other work, such as opening a socket whose messages call `notify` from another store. The effect would close the socket and open it again when `notify` arrives, and whether that happens depends on whether the other store was already running. Return early only when the effect cannot work without the action; otherwise read the action from [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent) or a ref, or emit an event the other side subscribes to (see [Events from a store](/guide/events)).

- **Lookups by id**: a record can lack an id even after loading, when the item was deleted while a list still holds its id. Turn on TypeScript's [`noUncheckedIndexedAccess`](https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess) so the compiler asks for the check. See [Data across stores](/guide/how-it-works#data-across-stores).

## What's next

- [How it works](/guide/how-it-works): the model behind these four steps.
- [Store options](/guide/store-options): `timeToClean` and `schedule`.
- [Selectors](/guide/selectors) and [Update cadence](/guide/update-cadence) for finer control over rendering.
- [`useMultipleStore`](/api/use-multiple-store) to read a list of instances in one call.
- [Testing](/guide/testing) for how to test components that use a store.
