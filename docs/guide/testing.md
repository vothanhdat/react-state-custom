# Testing

A store is a hook, so it is tested like one: render something that uses it, interact, assert. What is specific to the library is covered here, with the helpers of the `react-state-custom/testing` entry:

```ts
import { mockStore, resetStores, storeHandle, waitForStore } from 'react-state-custom/testing'
```

Each helper takes a store by any function `createStore` returned for it, usually the `useStore` hook its module exports. They work with Vitest and Jest and need no particular rendering library. See the [API reference](/api/testing).

## Mount a root

Components that call `useStore` need an `AutoRootCtx` in the tree, otherwise the store hook never runs and the consumer sees only `initialState`. Render the subject under one:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { AutoRootCtx } from 'react-state-custom'

it('increments', () => {
  render(
    <>
      <AutoRootCtx />
      <Counter />
    </>
  )
  fireEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('button')).toHaveTextContent('1')
})
```

Updates are published synchronously from a layout effect, so no `waitFor` is needed for state changes that do not involve async work.

## Isolate tests from each other

Store state lives in contexts cached by the library, outside the rendered tree. Unmounting a tree stops its stores, but a context that something still holds keeps its values, for example a `subscribe` listener or a `retain()` the test never released, and the next test then starts from them. Call `resetStores()` after each test, once the trees are unmounted:

```ts
// a setup file: Vitest's setupFiles, Jest's setupFilesAfterEnv
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetStores } from 'react-state-custom/testing'

afterEach(() => {
  cleanup()
  resetStores()
})
```

It drops every cached context with its state and removes every [mock](#mock-a-store). This is what the library's own test suite does.

Rendering each test inside a `StateScopeProvider` also isolates it: every scope has its own instances, and the scope unmounts with the test. Mocks still apply inside a scope, but [`storeHandle`](#drive-a-store-from-outside) and [`waitForStore`](#wait-for-a-store) reach the global scope only.

## Mock a store

`mockStore(useStore, values)` makes the instances that start afterwards publish `values` instead of running the store's hook. A component test then needs neither the network nor the stores behind the one it reads.

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { mockStore } from 'react-state-custom/testing'
import { useTasks } from './stores'

it('lists the tasks and adds one', () => {
  const addTask = vi.fn()
  const tasks = mockStore(useTasks, {
    tasks: { a: { id: 'a', title: 'Write docs' } },
    addTask,
  })
  render(<><AutoRootCtx /><TaskList projectId="p1" /></>)
  expect(screen.getByText('Write docs')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(addTask).toHaveBeenCalledWith({ title: '' })

  act(() => tasks.set({ tasks: {} }))   // merged over the mock; readers re-render
  expect(screen.queryByText('Write docs')).toBeNull()
})
```

- **Some keys are enough.** The values are typed against the store's state: a misspelled key or a wrong value type is a compile error, and keys left out read as `undefined`, as before data arrives.
- **Actions are the functions you pass.** They are published like the store's own actions, so keep a reference to the `vi.fn()` and assert on it.
- **A hook works too.** Pass `(params, preState) => values`. It receives each instance's params and may use hooks, so a mock can keep state of its own or answer per id:

  ```ts
  mockStore(useTask, ({ taskId }) => ({ task: fixtures[taskId] }))
  ```

- **A failure is a mock that throws.** `mockStore(useTasks, () => { throw new Error('offline') })` fails the store as its own hook would: readers keep `initialState`, `useStoreStatus` reports `failed`, and `useStoreSuspense` throws the error to its error boundary.
- **What still applies:** `initialState` (readers see it on their first render) and `timeToClean`. The store's `AttachedComponent` does not run.

A mock applies to instances that start after it. Call `mockStore` before rendering; an instance that is already running keeps the store's hook, and `mockStore` logs a warning about it. `restore()` on the returned handle stops mocking for instances started later, and `resetStores()` removes every mock.

## Test the hook directly

A store hook is a plain hook. `renderHook` from Testing Library exercises it without any store machinery:

```ts
import { renderHook, act } from '@testing-library/react'

const { result } = renderHook(() => useCounterState({ initial: 5 }))
act(() => result.current.increment())
expect(result.current.count).toBe(6)
```

A hook that reads other stores needs a root for them, and those stores can be mocked:

```tsx
mockStore(useSession, { user: { id: 'u1', name: 'Dat' } })
const { result } = renderHook(() => useCartState({ currency: 'EUR' }), {
  wrapper: ({ children }) => <><AutoRootCtx />{children}</>,
})
expect(result.current.owner).toBe('Dat')
```

## Drive a store from outside

`storeHandle(useStore, params)` returns the store's [`getStore(params)` handle](/api/create-store#getstore-params) from whichever function its module exports: read the state with `get()`, call actions, `subscribe`, check `ready` and `error`.

```ts
render(<><AutoRootCtx /><Cart /></>)
const cart = storeHandle(useCart)
act(() => cart.get().addItem!({ id: 1, price: 10 }))
expect(cart.get().items).toHaveLength(1)
```

A store with no consumer on screen can be kept running with `retain()`:

```ts
const release = storeHandle(useCart).retain()
// ... assertions ...
release()
```

Like `getStore`, it reaches the global scope, so render the subject under `AutoRootCtx`, not inside a `StateScopeProvider`.

## Wait for a store

`waitForStore(useStore, params, keys)` waits until each listed key holds a value and resolves with the state, those keys typed as present, as with [`useStoreSuspense`](/guide/suspense):

```ts
render(<><AutoRootCtx /><TaskList projectId="p1" /></>)
const { tasks } = await waitForStore(useTasks, { projectId: 'p1' }, ['tasks'])
expect(Object.keys(tasks)).toHaveLength(3)
expect(screen.getByText('Write docs')).toBeInTheDocument()   // the readers have re-rendered
```

- Without keys it waits until the store has published once; with a predicate, until `isReady(state)` returns true.
- It rejects with what the store hook threw if the store fails, and after `timeout` (default 1000 ms, like Testing Library's `waitFor`) with the reason: no instance is running, the store has not published yet, or which keys are still `undefined`.
- It does not start the store. Render a component that reads it, or `retain()` it first.
- While it waits, React's act environment is off, as in Testing Library's `waitFor`, so the store's own updates do not log "not wrapped in act" warnings.

## Fake timers

`timeToClean` and the context cache use `setTimeout`. With `vi.useFakeTimers()` (or Jest's), advance timers to observe teardown:

```ts
vi.useFakeTimers()
unmount()
act(() => { vi.advanceTimersByTime(5000) })  // timeToClean elapsed; the hook's effects have cleaned up
```

`waitForStore` still resolves as soon as the store's state matches, but its timeout fires only when the timers are advanced.

## StrictMode

The library is tested under `<StrictMode>`. If your test setup enables it globally (Testing Library's `configure({ reactStrictMode: true })`), render counts double during development; disable it for tests that count renders.
