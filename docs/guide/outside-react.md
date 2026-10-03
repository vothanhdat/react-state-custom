# Outside React

`getStore(params)` is an imperative handle for code that is not a component: socket handlers, routers, tests, or an event handler that needs the latest value without subscribing.

```ts
const { getStore: getCartStore } = createStore('cart', useCartState, { initialState: { items: [] } })

const cart = getCartStore({ userId: '42' })

cart.get().items              // plain snapshot, safe anywhere
cart.get().addItem(item)      // actions are part of the state
cart.ready                    // has the hook published at least once?

const stop = cart.subscribe((state, changedKey) => sync(state))
stop()

const release = cart.retain() // keep the store running with no component reading it
release()
```

## `get()`

Returns a plain object: `initialState` merged with everything the hook has published. It never subscribes and never creates a store. Before any consumer has mounted the store it returns `initialState` (or `{}`), so actions are `undefined` until the hook has run; check `ready` or `retain()` first when you need them.

## `subscribe(listener)`

Delivers every change with the changed key, in the same synchronous pass as the store's publish. The listener must not throw; see [Error handling](/guide/error-handling). Subscribing keeps the context alive but does not run the store hook; pair it with a mounted consumer or `retain()`.

## `retain()`

Mounts the store through the global `AutoRootCtx` and counts as a consumer: the store is torn down after `timeToClean` once every component and every retainer is gone. Call the returned function to release. In development it logs an error if no `AutoRootCtx` is mounted within a second.

```ts
// a websocket client that keeps the session store alive while connected
const release = getSessionStore().retain()
socket.on('close', release)
```

## Keep a task running after its screen closes

A store can retain itself while it has work to finish, so the work outlives the screen that started it. An upload keeps going when the user navigates away, and the store is released once it is done:

```ts
export const { useStore: useUpload, getStore: getUpload } = createStore('upload', ({ id }: { id: string }) => {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'failed'>('idle')
  const [progress, setProgress] = useState(0)

  // while uploading, the store holds itself: closing the screen does not cancel the upload
  useEffect(() => {
    if (status !== 'uploading') return
    return getUpload({ id }).retain()
  }, [status, id])

  const start = (file: File) => {
    setStatus('uploading')
    uploadFile(id, file, setProgress).then(() => setStatus('done'), () => setStatus('failed'))
  }
  return { status, progress, start }
}, { timeToClean: 10_000 }) // a screen opened soon after still sees "done"
```

Every screen that calls `useUpload({ id })` shows the same progress, including one opened after the first has closed. `getStore` reaches the global scope only, so keep such a store out of a `StateScopeProvider`.

## Scopes

`getStore` works in the **global** scope only. Inside a `StateScopeProvider`, components reach their instance through `useCtxState(params)`, which returns the scope's `Context`:

```tsx
const ctx = useCtxState({ userId })
useEffect(() => ctx.subscribeAll((key, data) => sync(data)), [ctx])
```

## Reading the latest value in an event handler

The proxy returned by `useStore` only tracks reads during render. In a handler, either use the value destructured during render, or read a fresh snapshot:

```ts
const onClick = () => console.log(getCartStore().get().items)
```

See [Reads outside render](/guide/reads-outside-render).
