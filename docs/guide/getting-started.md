# Getting started

## Install

```bash
npm install react-state-custom
# or
yarn add react-state-custom
```

React 18 or newer is required. `react` and `react-dom` are peer dependencies. The package ships ESM and CommonJS builds with TypeScript declarations.

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

`createStore` registers the hook under a name and returns the consumer hooks.

```ts
// features/userStore.ts
import { createStore } from 'react-state-custom'
import { useUserState } from './userState'

export const { useStore: useUserStore } = createStore('user', useUserState, {
  initialState: { user: null, isLoading: true },
})
```

`initialState` is what consumers read before the hook has run for the first time. Without it those keys are `undefined` on the very first render and typed as optional. See [Store options](/guide/store-options).

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

A store starts when its first reader mounts, so on that reader's first render the hook has not run yet: every key is `undefined`, actions included, unless [`initialState`](/guide/store-options#initialstate) seeds it. Data from a fetch or a socket stays `undefined`, or the `null` you start it with, until it arrives. The types say so: every key of the `useStore` result is optional. Check values before using them.

```tsx
function TaskTitle({ projectId, id }: { projectId: string; id: string }) {
  const task = useTasks({ projectId }, s => s.tasks?.[id])
  if (!task) return null                 // not loaded yet, or just deleted
  return <span>{task.title}</span>
}

function Total() {
  const { total, checkout } = useCart()
  return <button onClick={() => checkout?.()}>{total ?? '…'}</button>
}
```

- **Data**: read with `?.`, fall back with `??`, or return a placeholder early.
- **Actions**: call them with `?.()` from event handlers. By the time anyone clicks, the store has run and the action exists. A call made while rendering, or from an effect when the component mounts, comes before the store has run and does nothing. Start loading inside the store, which runs its own effects; if a component must call an action from an effect, list the action as a dependency so the effect runs again once it exists. Actions keep their identity after that, so it runs once more, not on every render.

  ```ts
  const { load } = useReport({ id })
  useEffect(() => { load?.(range) }, [load, range])   // runs again when `load` arrives
  ```

- **Lookups by id**: a record can lack an id even after loading, when the item was deleted while a list still holds its id. Turn on TypeScript's [`noUncheckedIndexedAccess`](https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess) so the compiler asks for the check. See [Data across stores](/guide/how-it-works#data-across-stores).

## What's next

- [How it works](/guide/how-it-works): the model behind these four steps.
- [Store options](/guide/store-options): `initialState`, `timeToClean`, `AttachedComponent`.
- [Selectors](/guide/selectors) and [Suspense](/guide/suspense) for finer control over rendering.
- [Testing](/guide/testing) for how to test components that use a store.
