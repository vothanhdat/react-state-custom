# Reads outside render

The object returned by `useStore` is a proxy that tracks reads **during render**. Reading it later, in an event handler or an effect, returns the current value but does not subscribe, and logs a one-time development warning per key.

```tsx
// ✅ tracked: destructure during render
const { count, increment } = useStore()
const onClick = () => console.log(count)

// ⚠️ not tracked: the proxy is read inside the handler
const store = useStore()
const onClick = () => console.log(store.count)

// ✅ latest value in a handler without subscribing
const onClick = () => console.log(getStore().get().count)
```

Destructure what you need at the top of the component. The value in `count` is the one from the last render, which is what a handler usually wants. For a value that may have changed since, use `getStore().get()`.

## Spreading the proxy

`{ ...useStore() }` and `Object.keys(useStore())` enumerate every key and therefore subscribe to all of them. The library logs a development warning when it sees this, because the component then re-renders on every change in the store. Pick the keys you need instead.

## Passing the proxy around

Passing the proxy to a helper that reads from it during render is fine; reads are tracked wherever they happen as long as they happen during that component's render.

```ts
const label = describe(useStore()) // reads inside describe() are tracked
```

The proxy is a new object on every render. Do not use it as a dependency of `useEffect`, `useMemo` or `useCallback`, and do not store it in a ref for later: use the values read from it. This is also what makes it safe under the [React Compiler](/guide/react-compiler).

## Symbols and non-string keys

Symbol keys pass through untracked, so the proxy can be inspected by dev tools and logged without creating subscriptions.
