# Testing

A store is a hook, so it is tested like one: render something that uses it, interact, assert. What is specific to the library is covered here, with the helpers of the `react-state-custom/testing` entry:

```ts
import { flushScheduled, mockStore, resetStores, storeHandle, waitForStore } from 'react-state-custom/testing'
```

Each helper takes a store by any function `createStore` returned for it, usually the `useStore` hook its module exports. They work with Vitest and Jest and need no particular rendering library. See the [API reference](/api/testing).

## Mount a root

Components that call `useStore` need an `AutoRootCtx` in the tree, otherwise the store hook never runs and the reader sees only `undefined`. Render the subject under one:

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
- **A hook works too.** Pass `(params) => values`. It receives each instance's params and may use hooks, so a mock can keep state of its own or answer per id:

  ```ts
  mockStore(useTask, ({ taskId }) => ({ task: fixtures[taskId] }))
  ```

- **A failure is a mock that throws.** `mockStore(useTasks, () => { throw new Error('offline') })` fails the store as its own hook would: its readers throw the error for their error boundary, and `storeRef(params).error` holds it.
- **What still applies:** `timeToClean`.

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

When the module exports the store's `storeRef`, use it: read the state with `get()`, call actions, `subscribe`, check `ready` and `error`. `storeHandle(useStore, params)` returns the same [`storeRef(params)`](/api/create-store#storeref-params) from whichever function the module exports, `useStore` alone included.

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

Like `storeRef`, it only reaches a running instance through `AutoRootCtx`: render one, or the subject under it.

## Wait for a store

`waitForStore(useStore, params, keys)` waits until each listed key holds a value and resolves with the state, those keys typed as present:

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

## Fake the transport

A store that owns a socket or an API is tested against a fake of that module, whose responses and messages the test sends one by one. Then a test can reproduce a race: an event that arrives while the snapshot request is in flight, a stream message that beats the response to a command.

```tsx
// vi.hoisted: vi.mock is hoisted above the imports, so what it uses must be too
const fake = vi.hoisted(() => {
  const handlers = new Set<(msg: unknown) => void>()
  const deferred = <T,>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>(r => { resolve = r })
    return { promise, resolve }
  }
  return { handlers, deferred, emit: (msg: unknown) => handlers.forEach(h => h(msg)), api: { getAccount: vi.fn() } }
})

vi.mock('../src/api/exchange', () => ({
  api: fake.api,
  socket: {
    subscribe: (_channel: string, handler: (msg: unknown) => void) => {
      fake.handlers.add(handler)
      return () => fake.handlers.delete(handler)
    },
  },
}))

it('applies the events that arrive while the snapshot is in flight, and only those it does not contain', async () => {
  const snapshot = fake.deferred<AccountSnapshot>()
  fake.api.getAccount.mockReturnValueOnce(snapshot.promise)
  render(<AutoRootCtx />)
  const release = storeHandle(useAccount).retain()     // a core store, started without a view
  await waitForStore(useAccount, undefined, ['placeOrder'])

  act(() => fake.emit({ type: 'balances', seq: 9, balances: [{ asset: 'USD', free: 1 }] }))     // older than the snapshot
  act(() => fake.emit({ type: 'balances', seq: 11, balances: [{ asset: 'USD', free: 900 }] }))  // newer
  await act(async () => snapshot.resolve({ seq: 10, balances: [{ asset: 'USD', free: 1000 }], orders: [] }))

  const state = await waitForStore(useAccount, undefined, s => s.status === 'ready')
  expect(state.balances?.USD?.free).toBe(900)
  release()
})
```

In an app [organized in layers](/guide/layers), each layer is tested against the one below it: core stores against a fake transport like this one, UI stores and hooks against mocked core stores, views against mocked UI stores.

## Scheduled readers

A component reading with a [`schedule`](/guide/update-cadence) renders a change later: in the next frame, after a throttle period, when idle. `flushScheduled()` makes every pending scheduled render happen now. It covers `useFrameState` updates and `scheduled` functions too:

```ts
const book = mockStore(useBook, { mid: 100 })
render(<><AutoRootCtx /><DepthChart /></>)          // reads with { schedule: throttle(100) }
act(() => book.set({ mid: 101 }))
act(() => { flushScheduled() })
expect(screen.getByTestId('mid')).toHaveTextContent('101')
```

What those renders publish can schedule more: a component reading a store fed by a frame-buffered store needs a second call. With fake timers, advancing the clock runs them instead (`vi.advanceTimersToNextFrame()` for frames). A store's first data is never scheduled, so `waitForStore` and first-render assertions need nothing extra.

## Fake timers

`timeToClean` and the context cache use `setTimeout`. With `vi.useFakeTimers()` (or Jest's), advance timers to observe teardown:

```ts
vi.useFakeTimers()
unmount()
act(() => { vi.advanceTimersByTime(5000) })  // timeToClean elapsed; the hook's effects have cleaned up
```

`waitForStore` still resolves as soon as the store's state matches, but its timeout fires only when the timers are advanced.

Vitest 4's fake timers also fake `requestAnimationFrame`, which [scheduled readers](#scheduled-readers) wait for: `vi.advanceTimersToNextFrame()` runs a frame. jsdom has no `requestIdleCallback`, so the idle schedule falls back to a timer of its `ms`. A throttle period starts in a microtask after the first change, so let it run (`await act(async () => {})`) before advancing the clock.

## StrictMode

The library is tested under `<StrictMode>`. If your test setup enables it globally (Testing Library's `configure({ reactStrictMode: true })`), render counts double during development; disable it for tests that count renders.
