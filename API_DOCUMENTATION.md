# React State Custom - API Reference

a hook-first state management toolkit for React 19 applications. Every export surfaces typed utilities for wiring headless state containers, publishing updates, and consuming them with fine-grained subscriptions.

> First time here? Skim the “Quick Start (2 minutes)” section in `README.md` before diving into the API surface.

🎮 **[Try the Live Demo →](https://vothanhdat.github.io/react-state-custom/)**

---

## Contents

- [React State Custom - API Reference](#react-state-custom---api-reference)
  - [Contents](#contents)
  - [Core Context System](#core-context-system)
    - [`Context`](#context)
    - [`getContext`](#getcontext)
    - [`useDataContext`](#usedatacontext)
  - [Publishing Hooks](#publishing-hooks)
    - [`useDataSource`](#usedatasource)
    - [`useDataSourceMultiple`](#usedatasourcemultiple)
  - [Subscription Hooks](#subscription-hooks)
    - [`useDataSubscribe`](#usedatasubscribe)
    - [`useDataSubscribeMultiple`](#usedatasubscribemultiple)
    - [`useDataSubscribeMultipleWithDebounce`](#usedatasubscribemultiplewithdebounce)
    - [`useDataSubscribeWithTransform`](#usedatasubscribewithtransform)
    - [`useQuickSubscribe`](#usequicksubscribe)
  - [Store Factory](#store-factory)
    - [`createStore`](#createstore)
  - [Root Context Factory](#root-context-factory)
    - [`createRootCtx`](#createrootctx)
  - [Auto Context System](#auto-context-system)
    - [`AutoRootCtx`](#autorootctx)
    - [`createAutoCtx`](#createautoctx)
  - [Developer Tools](#developer-tools)
    - [`DevToolContainer`](#devtoolcontainer)
    - [`DataViewComponent`](#dataviewcomponent)
  - [Utility Hooks](#utility-hooks)
    - [`useArrayChangeId`](#usearraychangeid)
  - [Types](#types)
    - [`ParamsToIdRecord`](#paramstoidrecord)
  - [Usage Patterns](#usage-patterns)
    - [Basic Context Wiring](#basic-context-wiring)
    - [Headless Root + Auto Context](#headless-root--auto-context)
  - [Live Examples](#live-examples)

---

## Core Context System

### `Context`

EventTarget-backed data store that tracks the latest values for a shape `D` and notifies listeners on change.

```ts
class Context<D> extends EventTarget {
  constructor(name: string)
  name: string
  data: Partial<D>
  registry: Set<string>
  useCounter: number
  publish(key: keyof D, value: D[keyof D] | undefined): void
  subscribe(key: keyof D, listener: (value: D[keyof D] | undefined) => void): () => void
  subscribeAll(listener: (key: keyof D, snapshot: Partial<D>) => void): () => void
}
```

- Publishes only when `value != data[key]` (loose inequality for shallow detection).
- `subscribe` immediately invokes the listener with the current value if present.
- `subscribeAll` fires for every key update via an internal `@--change-event` broadcast.
- `registry` collects active publishers for duplicate detection (see `useDataSource*`).

```ts
interface UserState { name: string; age: number }
const users = new Context<UserState>("users")
const stop = users.subscribe("name", value => console.log("name →", value))
users.publish("name", "Ada Lovelace")
stop()
```

### `getContext`

Memoized `Context` factory keyed by name.

```ts
function getContext(name: string): Context<any>
```

- Returns the same instance for repeated calls with identical arguments.
- Internally memoized via JSON-stringified arguments and pruned when `useCounter` stays at zero for ~100 ms after unmount.

```ts
const sessionCtx = getContext("session")
const sameInstance = getContext("session")
console.assert(sessionCtx === sameInstance)
```

### `useDataContext`

React hook returning a typed `Context<D>` by name.

```ts
function useDataContext<D>(name?: string): Context<D>
```

- Memoizes `getContext(name)` and increments `ctx.useCounter` while mounted.
- Automatically evicts unused contexts shortly after the last consumer unmounts.

```tsx
function SessionProvider({ children }: { children: React.ReactNode }) {
  const ctx = useDataContext<{ token?: string }>("session")
  useDataSource(ctx, "token", readSessionToken())
  return <>{children}</>
}
```

---

## Publishing Hooks

### `useDataSource`

Publishes a single key whenever `value` changes.

```ts
function useDataSource<D, K extends keyof D>(
  ctx: Context<D> | undefined,
  key: K,
  value: D[K] | undefined
): void
```

- Publishes inside an effect to avoid React render side effects.
- Skips publication when `ctx` is undefined or `value == ctx.data[key]`.
- Registers `key` in `ctx.registry`; duplicate publishers log an error with a captured stack trace.

```tsx
function UserSource({ userId }: { userId: string }) {
  const ctx = useDataContext<UserState>("user")
  const profile = useUserProfile(userId)
  useDataSource(ctx, "profile", profile)
  return null
}
```

### `useDataSourceMultiple`

Batch publisher for multiple `[key, value]` tuples.

```ts
function useDataSourceMultiple<D, T extends readonly (keyof D)[]>(
  ctx: Context<D> | undefined,
  ...entries: { -readonly [P in keyof T]: [T[P], D[T[P]]] }
): void
```

- Shallow-compares each pair and publishes only the changed ones.
- Dependencies collapse to a hash from [`useArrayChangeId`](#usearraychangeid); pass stable tuples to avoid extra flushes.
- Runs the same duplicate-source safety check as `useDataSource`.

```tsx
useDataSourceMultiple(ctx,
  ["user", user],
  ["theme", theme],
  ["isLoading", loading],
)
```

---

## Subscription Hooks

### `useDataSubscribe`

Subscribes to a single key with optional debounce.

```ts
function useDataSubscribe<D, K extends keyof D>(
  ctx: Context<D> | undefined,
  key: K,
  debounceTime?: number
): D[K] | undefined
```

- Uses React state to trigger re-renders; initial state mirrors `ctx?.data[key]`.
- `debounceTime > 0` wraps updates in `debounce` with `.cancel()` support on cleanup.
- Returns the live value (`ctx?.data[key]`) so reads stay current even if the hook is mid-debounce.

```tsx
const searchQuery = useDataSubscribe(ctx, "query", 250)
```

### `useDataSubscribeMultiple`

Observes several keys and re-renders when any value differs from the previous snapshot.

```ts
function useDataSubscribeMultiple<D, K extends readonly (keyof D)[]>(
  ctx: Context<D> | undefined,
  ...keys: K
): { [P in K[number]]: D[P] | undefined }
```

- Aggregates values into an object keyed by the provided names.
- Internally debounces change detection to the next macrotask (1 ms) to coalesce bursts.
- Automatically unsubscribes all listeners on unmount.

```tsx
const { user, isLoading } = useDataSubscribeMultiple(ctx, "user", "isLoading")
```

### `useDataSubscribeMultipleWithDebounce`

Like `useDataSubscribeMultiple`, but allows specifying a debounce window.

```ts
function useDataSubscribeMultipleWithDebounce<D, K extends (keyof D)[]>(
  ctx: Context<D> | undefined,
  debounceTime?: number,
  ...keys: K
): { [i in keyof K]: D[K[i]] | undefined }
```

- Default debounce is 50 ms.
- Returns an array keyed by index (matches the order of `keys`).

```tsx
const [query, filters] = useDataSubscribeMultipleWithDebounce(ctx, 200, "query", "filters")
```

### `useDataSubscribeWithTransform`

Subscribes to one key and recomputes derived data lazily.

```ts
function useDataSubscribeWithTransform<D, K extends keyof D, E>(
  ctx: Context<D> | undefined,
  key: K,
  transform: (value: D[K] | undefined) => E
): E
```

- Memoizes `transform(ctx?.data[key])` and only triggers the internal `setState` when the transformed value actually changes (`!=`).
- Handy for formatting or computing derived values without extra selectors.

```tsx
const stats = useDataSubscribeWithTransform(ctx, "profile", profile => ({
  postCount: profile?.posts?.length ?? 0,
  joinedAt: profile?.createdAt ? new Date(profile.createdAt) : null,
}))
```

### `useQuickSubscribe`

Proxy-based subscription that tracks which properties you read during render and subscribes to those keys only.

```ts
function useQuickSubscribe<D>(
  ctx: Context<D> | undefined
): { [P in keyof D]?: D[P] | undefined }
```

- Wraps `ctx?.data` in a `Proxy`; the first read cycle records accessed keys.
- After render, subscribes to the accessed set and cleans up unused subscriptions automatically.
- Subsequent renders reuse the same proxy; avoid storing it outside render scope.

```tsx
const { total, items } = useQuickSubscribe(cartCtx)
```

> ⚠️ The proxy intentionally throws when accessed outside of render. Always destructure the fields you need synchronously during render and avoid passing the proxy to refs, effects, or callbacks.

---

## Store Factory

### `createStore`

The all-in-one helper that combines `createRootCtx` and `createAutoCtx` into a single call. This is the recommended way to create stores in most applications.

```ts
function createStore<U extends ParamsToIdRecord, V extends Record<string, unknown>>(
  name: string,
  useFn: (params: U, preState: Partial<V>) => V,
  timeToClean?: number,
  AttatchedComponent?: React.FC<U>
): {
  useCtxState(params: U): Context<V>
  useStore(params: U): { [P in keyof V]?: V[P] | undefined }
}
```

- **`name`**: Unique namespace for this store.
- **`useFn`**: The hook that defines your state logic.
- **`timeToClean`**: Optional delay (ms) before unmounting the store after the last subscriber leaves.
- **`AttatchedComponent`**: Optional component to render alongside the store (useful for side effects).

Returns an object with:
- **`useStore`**: A hook that subscribes to the store and returns a proxy for reading state.
- **`useCtxState`**: A hook that returns the raw `Context` object (for advanced usage).

```tsx
// 1. Define store
const { useStore } = createStore('counter', () => {
  const [count, setCount] = useState(0);
  return { count, setCount };
});

// 2. Use in component
function Counter() {
  const { count, setCount } = useStore({});
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

---

## Root Context Factory

### `createRootCtx`

Creates a headless Root component that runs your hook `useFn(props, preState)` exactly once per parameter set and publishes its return shape into a derived context namespace. `preState` is the previously published data for that context name (if any), useful for rehydrating state after an auto-unmount/remount cycle.

```ts
import { ParamsToIdRecord } from 'react-state-custom'

function createRootCtx<U extends ParamsToIdRecord, V extends Record<string, unknown>>(
  name: string,
  useFn: (params: U, preState: Partial<V>) => V
): {
  name: string
  getCtxName(params: U): string
  useRootState(params: U): V
  Root: React.FC<U>
  useCtxState(params: U): Context<V>
  useCtxStateStrict(params: U): Context<V>
}
```

Key behaviors:

- Context name = `name` plus serialized, sorted props (for example `user-state-userId-123`).
- `useFn` receives the last published state (if any) as `preState`, so you can warm start when a Root remounts.
- The generated `Root` publishes every key returned by `useFn` via `useDataSourceMultiple`.
- Duplicate `Root` mounts with the same resolved name throw (stack trace captured at mount).
- Props passed to `Root`/`useCtxState` must be primitives (string/number/boolean/bigint/null/undefined); `paramsToId` rejects objects so context IDs remain deterministic.
- `useCtxStateStrict` throws if the `Root` is missing; `useCtxState` schedules a delayed `console.error` instead (1 s).

```tsx
const { Root: UserRoot, useCtxState } = createRootCtx("user", useUserState)

function UserProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  return (
    <>
      <UserRoot userId={userId} />
      {children}
    </>
  )
}

function UserName({ userId }: { userId: string }) {
  const ctx = useCtxState({ userId })
  const { profile } = useDataSubscribeMultiple(ctx, "profile")
  return <span>{profile?.name}</span>
}
```

---

## Auto Context System

### `AutoRootCtx`

Global manager that renders requested Root instances lazily.

```ts
function AutoRootCtx(props: {
  Wrapper?: React.FC<any>
  debugging?: boolean
}): JSX.Element
```

- Mount exactly once near your app root.
- Stores a registry of active roots in the special context `auto-ctx`, publishing `subscribe` and `state` for internal coordination.
- Each subscription entry tracks usage count and optional delayed teardown (`keepUntil`).
- `Wrapper` lets you provide an ErrorBoundary-like component; defaults to `Fragment`. Set `debugging` to render ephemeral state snapshots for inspection.

```tsx
function App() {
  return (
    <>
      <AutoRootCtx Wrapper={ErrorBoundary} />
      <Routes />
    </>
  )
}
```

### `createAutoCtx`

Connects a `createRootCtx` factory to `AutoRootCtx`, returning a consumer hook that ensures the corresponding Root is mounted on demand.

```ts
function createAutoCtx<U extends ParamsToIdRecord, V extends Record<string, unknown>>(
  rootCtx: ReturnType<typeof createRootCtx<U, V>>,
  unmountDelayMs?: number,
  AttatchedComponent?: React.FC<U>
): {
  useCtxState(params: U): Context<V>
  useStore(params: U): { [P in keyof V]?: V[P] | undefined }
}
```

- Subscribes to the global `auto-ctx` context and asks `AutoRootCtx` to mount the root.
- `unmountDelayMs` (default 0) keeps instances alive briefly after the last subscriber disconnects, smoothing mount/unmount thrash.
- `AttatchedComponent` (optional) is a React component that receives the same params as the state hook. It renders alongside each auto-mounted root instance, useful for side effects, portals, or UI that should live alongside the state.
- Consumers simply call `useCtxState(params)` or `useStore(params)`; no manual Root mounting required.

```tsx
const { useCtxState: useUserCtx, useStore: useUserStore } = createAutoCtx(createRootCtx("user", useUserState), 200)

function UserCard({ userId }: { userId: string }) {
  // Quick access via useStore
  const { profile } = useUserStore({ userId })
  
  // Or manual context access
  const ctx = useUserCtx({ userId })
  // ...
  return <Card>{profile?.name}</Card>
}
```

**With AttatchedComponent:**

```tsx
// A component that logs when a user context is active
const UserLogger: React.FC<{ userId: string }> = ({ userId }) => {
  useEffect(() => {
    console.log(`User ${userId} context mounted`)
    return () => console.log(`User ${userId} context unmounted`)
  }, [userId])
  return null
}

const { useCtxState: useUserCtx } = createAutoCtx(
  createRootCtx("user", useUserState),
  200,
  UserLogger
)
```

---

## Developer Tools

### `DevToolContainer`

Popup inspector that renders the current data snapshot for every context.

```ts
function DevToolContainer(props: {
  toggleButton?: string
  Component?: DataViewComponent
  style?: React.CSSProperties
  children?: React.ReactNode
}): JSX.Element
```

- Togglable overlay; pass `Component` to customize how values render (defaults to JSON).
- Docks to the bottom of the viewport and exposes resizable panes (via `@uiw/react-split`) so you can balance app viewport and inspector real estate on the fly.
- Import `react-state-custom/dist/react-state-custom.css` to get the required styles.
- Provide `children` to override the floating toggle button label (defaults to "Toggle Dev Tool").
- Works best alongside `<AutoRootCtx />` so all contexts are represented.

```tsx
import "react-state-custom/dist/react-state-custom.css"

function DevShell() {
  return (
    <>
      <AutoRootCtx />
      <YourApp />
      <DevToolContainer />
    </>
  )
}
```

### `DataViewComponent`

Type for custom dev tool renderers.

```ts
type DataViewComponent = React.FC<{ name: string; value: any }>
```

```tsx
const ObjectViewer: DataViewComponent = ({ name, value }) => (
  <section>
    <h3>{name}</h3>
    <pre>{JSON.stringify(value, null, 2)}</pre>
  </section>
)
```

---

## Utility Hooks

### `useArrayChangeId`

Shallow change detector for arrays. Returns a random string that flips whenever the tracked array differs from the last render.

```ts
function useArrayChangeId(values: any[]): string
```

- Compares length and each element via `!=`.
- Useful for collapsing complex tuple dependencies into a single stable key.

```tsx
const changeKey = useArrayChangeId(entries.flat())
useEffect(() => {
  // expensive work runs only when the tuple content changes
}, [changeKey])
```

---

## Types

### `ParamsToIdRecord`

Type constraint for parameters passed to `createRootCtx` and `createAutoCtx`. Only primitive values are allowed to ensure deterministic context naming.

```ts
type ParamsToIdRecord = Record<string, string | number | bigint | boolean | null | undefined>
```

- Keys must be strings
- Values must be primitives: `string`, `number`, `bigint`, `boolean`, `null`, or `undefined`
- Objects, arrays, and functions are **not allowed** and will throw at runtime via `paramsToId`

```tsx
// ✅ Valid params
const validParams = { userId: "123", count: 42, active: true }

// ❌ Invalid params (will throw)
const invalidParams = { user: { id: 123 } } // Objects not allowed
const invalidParams2 = { callback: () => {} } // Functions not allowed
```

This constraint ensures that context names remain deterministic and stable across renders, preventing accidental context duplication or collision.

---

## Usage Patterns

### Basic Context Wiring

```tsx
interface AppState {
  user?: User
  theme: "light" | "dark"
}

function AppRoot() {
  const ctx = useDataContext<AppState>("app-state")
  useDataSourceMultiple(ctx,
    ["user", useCurrentUser()],
    ["theme", useTheme()],
  )
  return <App />
}

function NavBar() {
  const ctx = useDataContext<AppState>("app-state")
  const { user, theme } = useDataSubscribeMultiple(ctx, "user", "theme")
  return <header className={theme}>Welcome {user?.name}</header>
}
```

### Headless Root + Auto Context

```tsx
function useCartState({ cartId }: { cartId: string }) {
  const [items, setItems] = useState<CartItem[]>([])
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.qty, 0), [items])
  return { items, total, setItems }
}

const cartRoot = createRootCtx("cart", useCartState)
const { useCtxState: useCartCtx } = createAutoCtx(cartRoot, 250)

function CartPanel({ cartId }: { cartId: string }) {
  const ctx = useCartCtx({ cartId })
  const { items, total } = useQuickSubscribe(ctx)
  return (
    <aside>
      <Total amount={total} />
      <ul>{items.map(renderLineItem)}</ul>
    </aside>
  )
}

function Shell() {
  return (
    <>
      <AutoRootCtx Wrapper={ErrorBoundary} />
      <CartPanel cartId="primary" />
    </>
  )
}
```

---

## Live Examples

Explore full working demos (counter, todo list, form, timer, cart) at the **[Live Demo](https://vothanhdat.github.io/react-state-custom/)**.
