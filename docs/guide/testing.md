# Testing

A store is a hook, so it is tested like one: render something that uses it, interact, assert. Three things are specific to the library.

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

Contexts are cached by name for a short time after their last user leaves, so a store used by two tests in a row can leak values between them, and a store with `timeToClean` can outlive the test that mounted it. Pick one of:

- **Render each test inside a `StateScopeProvider`.** Every scope has its own instances, and the scope unmounts with the test. This needs no access to internals.

  ```tsx
  render(
    <StateScopeProvider>
      <Counter />
    </StateScopeProvider>
  )
  ```

- **Clear the context cache after each test.** This is what the library's own test suite does.

  ```ts
  import { cleanup } from '@testing-library/react'
  import { getContext } from 'react-state-custom'

  afterEach(() => {
    cleanup()
    getContext.cache.clear()
  })
  ```

## Test the hook directly

A store hook is a plain hook. `renderHook` from Testing Library exercises it without any store machinery:

```ts
import { renderHook, act } from '@testing-library/react'

const { result } = renderHook(() => useCounterState({ initial: 5 }))
act(() => result.current.increment())
expect(result.current.count).toBe(6)
```

## Drive a store from outside

`getStore(params)` reads and acts on a store without rendering a consumer for it. It targets the global scope, so the subject must be rendered under `AutoRootCtx`, not inside a `StateScopeProvider`.

```ts
const { getStore } = createStore('cart', useCartState, { initialState: { items: [] } })

render(<><AutoRootCtx /><Cart /></>)
act(() => getStore().get().addItem!({ id: 1, price: 10 }))
expect(getStore().get().items).toHaveLength(1)
```

A store with no consumer on screen can be kept alive with `retain()`:

```ts
const release = getStore().retain()
// ... assertions ...
release()
```

## Fake timers

`timeToClean` and the context cache use `setTimeout`. With `vi.useFakeTimers()` (or Jest's), advance timers to observe teardown:

```ts
vi.useFakeTimers()
unmount()
act(() => { vi.advanceTimersByTime(5000) })  // timeToClean elapsed; the hook's effects have cleaned up
```

## StrictMode

The library is tested under `<StrictMode>`. If your test setup enables it globally (Testing Library's `configure({ reactStrictMode: true })`), render counts double during development; disable it for tests that count renders.
