# Selectors

Pass a selector as the second argument of `useStore` to re-render only when a derived or deep value changes.

```ts
const name = useUserStore({ userId }, s => s.user?.name)
const total = useCartStore(undefined, s => s.items.reduce((sum, i) => sum + i.price, 0))
const tags = usePostStore({ id }, s => s.post?.tags ?? [], shallowEqual)
```

- The selector receives the **plain state object** (`initialState` merged with the live data), not the tracking proxy, so it can read as deep as it likes and compute anything.
- The result is compared with `Object.is` after every publish. Pass your own `isEqual` as the third argument when the selector returns a fresh array or object each time.
- A new selector function on every render is fine; it is not used as a dependency.
- For stores without params pass `undefined` as the first argument.

## Proxy or selector?

The proxy returned by `useStore(params)` tracks **top-level keys**. Reading `user` subscribes to the whole `user` object: a change to `user.email` re-renders a component that only displayed `user.name`.

| Need | Use |
|---|---|
| A few top-level keys | `const { a, b } = useStore(params)` |
| One deep value | `useStore(params, s => s.user?.name)` |
| A derived value | `useStore(params, s => s.items.length)` |
| Several deep values | `useStore(params, s => ({ ... }), shallowEqual)` or several selector calls |

Both can be combined in one component. Each call is an independent subscription.

## Keeping the store small

Selectors are cheap, but a store that publishes one large object forces every selector to run on every change to that object. Where it is natural, return several keys from the hook instead of one nested object, so the proxy's key tracking can do the filtering.

```ts
// one key: every consumer runs its selector on each change
return { profile: { name, email, avatar, settings } }

// several keys: consumers subscribe only to what they read
return { name, email, avatar, settings }
```

## Under the hood

Selectors are implemented by `useDataSelector(ctx, selector, isEqual?)`, exported for use with raw contexts. See [Primitives](/api/primitives).
