# Outside React

`storeRef(params)` is one instance of a store, for code that is not a component: socket handlers, routers, tests, or an event handler that needs the latest value without subscribing.

```ts
const { storeRef: cartRef } = createStore('cart', useCartState)

const cart = cartRef({ userId: '42' })

cart.get().items              // plain snapshot, safe anywhere
cart.get().addItem?.(item)    // actions are part of the state
cart.ready                    // has the hook published at least once?

const stop = cart.subscribe((state, changedKey) => sync(state))
stop()

const release = cart.retain() // keep the store running with no component reading it
release()
```

## `get()`

Returns a plain object: everything the hook has published. It never subscribes and never starts a store. Before anything has run the store it returns `{}`, so actions are `undefined` until the hook has run; check `ready` or `retain()` first when you need them.

## `subscribe(listener)`

Delivers every change with the changed key, in the same synchronous pass as the store's publish. An update that changes several keys calls the listener once per key, and every call of that update gets the same snapshot object: treat it as read-only. The listener must not throw; see [Error handling](/guide/error-handling). Subscribing keeps the context alive but does not run the store hook; pair it with a mounted consumer or `retain()`.

## `retain()`

Mounts the store through the global `AutoRootCtx` and counts as a consumer: the store is torn down after `timeToClean` once every component and every retainer is gone. Call the returned function to release. In development it logs an error if no `AutoRootCtx` is mounted within a second.

```ts
// a websocket client that keeps the session store alive while connected
const release = sessionRef().retain()
socket.on('close', release)
```

## Keep a task running after its screen closes

A store can retain itself while it has work to finish, so the work outlives the screen that started it. An upload keeps going when the user navigates away, and the store is released once it is done:

```ts
export const { useStore: useUpload, storeRef: uploadRef } = createStore('upload', ({ id }: { id: string }) => {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'failed'>('idle')
  const [progress, setProgress] = useState(0)

  // while uploading, the store holds itself: closing the screen does not cancel the upload
  useEffect(() => {
    if (status !== 'uploading') return
    return uploadRef({ id }).retain()
  }, [status, id])

  const start = (file: File) => {
    setStatus('uploading')
    uploadFile(id, file, setProgress).then(() => setStatus('done'), () => setStatus('failed'))
  }
  return { status, progress, start }
}, { timeToClean: 10_000 }) // a screen opened soon after still sees "done"
```

Every screen that calls `useUpload({ id })` shows the same progress, including one opened after the first has closed.

## Refs are descriptions

A ref names an instance; it does not hold one. Making one is cheap (it serializes the params), and two refs with the same params reach the same instance, so make them where you need them. Only `retain()` and `subscribe()` hold anything, until you call what they return.

A ref is also what [`useMultipleStore`](/api/use-multiple-store) takes, to read several instances in one component.

In 1.x, `storeRef` reaches the global instances only: inside a deprecated `StateScopeProvider`, components read theirs with `useStore`. The old name `getStore` returns the same handle and is deprecated.

## Reading the latest value in an event handler

The proxy returned by `useStore` only tracks reads during render. In a handler, either use the value destructured during render, or read a fresh snapshot:

```ts
const onClick = () => console.log(cartRef({ userId }).get().items)
```

See [Reads outside render](/guide/reads-outside-render).
