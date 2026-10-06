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
const onClick = () => console.log(counterRef().get().count)
```

Destructure what you need at the top of the component. The value in `count` is the one from the last render, which is what a handler usually wants. For a value that may have changed since, read the store's ref: `counterRef().get()` (see [Outside React](/guide/outside-react)).

Actions are the exception: `store.increment?.()` in a handler logs nothing. An action needs no subscription, since it keeps its identity and always runs the store's latest implementation.

## Spreading the proxy

`{ ...useStore() }` and `Object.entries(useStore())` read every key, so the component re-renders whenever any of them changes, and when a key is added or removed. The library logs a development warning (once per store) when it sees this during render. Pick the keys you need instead.

`Object.keys(useStore())`, `for...in` and `'id' in store` read only which keys exist: the component re-renders when a key is added or removed, not when a value changes. That is how a list gets the ids of a [keyed collection](/guide/selectors#collections-keys-not-arrays).

## Writing to the proxy

The proxy is read-only. `store.count = 1` or `delete store.count` would change the data under every reader without notifying any of them, so in development it throws a `TypeError`. Change state inside the store hook, for example with a setter it returns.

## Passing the proxy around

Passing the proxy to a helper that reads from it during render is fine; reads are tracked wherever they happen as long as they happen during that component's render.

```ts
const label = describe(useStore()) // reads inside describe() are tracked
```

Tracking is tied to the render, not to the proxy object. A helper that reads from the proxy **later**, in an event handler, an effect, a timer or a promise callback, gets the current value but no subscription, and the development warning from above. Pass the values, not the proxy:

```tsx
// ⚠️ not tracked: the proxy is read when the handler runs, after render
const store = useStore()
const onSubmit = () => submit(store.draft)

// ✅ read during render, pass the value
const { draft } = useStore()
const onSubmit = () => submit(draft)

// ✅ or ask the store for the latest value when the handler runs
const onSubmit = () => submit(draftRef().get().draft)
```

The proxy is a new object on every render. Do not use it as a dependency of `useEffect`, `useMemo` or `useCallback`, and do not store it in a ref for later: use the values read from it. This is also what makes it safe under the [React Compiler](/guide/react-compiler).

### To a child component

A child that gets the proxy as a prop reads it in its own render. While the child renders together with the component that called `useStore`, its reads count as that component's. Once the child re-renders on its own, for its own state or context, its reads are not tracked: it shows the value of that moment, a later change of that key re-renders nothing, and the development warning says so. A new proxy every render also means a `memo` child re-renders with its parent every time.

```tsx
// ⚠️ the row reads `title` in its own render, which the list's proxy does not track
const List = () => {
  const todos = useTodos()
  return <Row todos={todos} />
}

// ✅ pass the values, or let the child call the store itself
const List = () => {
  const { title } = useTodos()
  return <Row title={title} />
}
const Row = () => {
  const { title } = useTodos()
  return <b>{title}</b>
}
```

## Symbols and non-string keys

Symbol keys pass through untracked, so the proxy can be inspected by dev tools and logged without creating subscriptions.
