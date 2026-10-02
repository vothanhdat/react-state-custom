# API Reference

Complete documentation for the `react-state-custom` API.

> **Note:** For most applications, you only need `createStore` and `AutoRootCtx`. The other APIs are lower-level primitives used internally or for advanced customization.

---

## ⚡ Primary API

### `createStore`

The main entry point. Converts a standard React hook into a shared, auto-managed store.

```typescript
function createStore<Params, State, Initial extends Partial<State> = {}>(
  name: string,
  useFn: (params: Params, preState: Partial<State>) => State,
  options?: number | StoreOptions<Params, State, Initial>
): {
  // `params` is optional when Params has no required keys
  useStore(params?: Params): StoreState<State, Initial>;
  useCtxState(params?: Params): Context<State>;
}
```

#### Arguments
- **`name`** *(string)*: A unique namespace for this store (e.g., `'user'`, `'cart'`).
- **`useFn`** *(function)*: Your custom hook. Receives `params` and `preState`, the values previously published by an instance with the same identity (useful to warm-start after a remount).
- **`options`** *(object or number, optional)*: a bare number is treated as `timeToClean`.
  - **`timeToClean`** *(number)*: Time in milliseconds to keep the store alive after the last subscriber unmounts. Defaults to `0`.
  - **`AttachedComponent`** *(Component)*: A React component that renders alongside the store root and receives the store `params`. Useful for side effects (like data fetching or logging) that should run exactly once per store instance.
  - **`initialState`** *(object or function of params)*: Values consumers read before the store hook has published anything. Keys listed here are typed as always present on the `useStore` result.

#### Returns
- **`useStore`**: The consumer hook. Call this in your components to read state. It returns a **proxy** that automatically tracks which properties you access during render to optimize re-renders. Reads outside render (handlers, effects) return the current value but are not tracked and log a development warning.
- **`useCtxState`**: Returns the raw `Context` object. Useful for advanced integrations.

Action functions returned by `useFn` keep a stable identity across store renders, so they can be used in dependency arrays and memoized children safely.

#### Example
```tsx
const useCounter = ({ initial = 0 }: { initial?: number }) => {
  const [count, setCount] = useState(initial);
  return { count, setCount };
};

export const { useStore } = createStore('counter', useCounter, {
  initialState: { count: 0 },
  timeToClean: 5000,
});
```

---

### `AutoRootCtx`

The global manager component. Must be mounted once at the top of your application.

```typescript
function AutoRootCtx(props: {
  Wrapper?: React.ComponentType<{ children?: React.ReactNode }>;
  debugging?: boolean;
}): JSX.Element
```

#### Props
- **`Wrapper`** *(Component, optional)*: A wrapper component rendered around each store instance. Defaults to [`StoreErrorBoundary`](#storeerrorboundary). Pass your own error boundary to render a fallback or report errors.
- **`debugging`** *(boolean, optional)*: If `true`, renders a raw view of the mounted stores in the DOM for debugging.

Using a store while no `AutoRootCtx` (or `StateScopeProvider`) is mounted logs a `console.error` in development after one second.

#### Example
```tsx
function App() {
  return (
    <>
      <AutoRootCtx Wrapper={MyErrorBoundary} />
      <Routes />
    </>
  );
}
```

---

### `StateScopeProvider`

Creates an isolated scope. Stores used inside it get their own instances, independent of the global scope and of any other `StateScopeProvider`, even when they share a store definition. It acts as its own root: no `AutoRootCtx` is needed inside.

```typescript
function StateScopeProvider(props: {
  children: React.ReactNode;
  Wrapper?: React.ComponentType<{ children?: React.ReactNode }>;
  debugging?: boolean;
}): JSX.Element
```

#### Example
```tsx
<AutoRootCtx />
<Editor />                     {/* global instance of useDocumentStore() */}
<StateScopeProvider>
  <Editor />                   {/* separate instance of useDocumentStore() */}
</StateScopeProvider>
```

---

### `StoreErrorBoundary`

The default `Wrapper` of `AutoRootCtx` and `StateScopeProvider`. When a store hook throws, the boundary catches the error, logs it with `console.error`, and stops rendering that store. Other stores and the application keep working. Consumers of the failed store keep reading its last published values.

```typescript
class StoreErrorBoundary extends React.Component<{ children?: React.ReactNode }> {}
```

---

## 🧩 Types

### `StoreOptions`

```typescript
type StoreOptions<Params, State, Initial extends Partial<State> = {}> = {
  timeToClean?: number;
  AttachedComponent?: React.ComponentType<Params>;
  initialState?: Initial | ((params: Params) => Initial);
};
```

### `StoreParams`

The argument list of `useStore` / `useCtxState`: `[params?: Params]` when `Params` has no required keys, `[params: Params]` otherwise.

### `StoreState`

What `useStore` returns: every key of `State` is optional (it is `undefined` until the hook runs), except the keys present in `Initial`, which are always defined.

```typescript
type StoreState<State, Initial> =
  { [K in keyof State]?: State[K] } & { [K in keyof Initial & keyof State]: State[K] };
```

### `ParamsToIdRecord`

Constraint for store parameters. All params must be primitive values to ensure deterministic IDs.

```typescript
type ParamsToIdRecord = Record<
  string,
  string | number | bigint | boolean | null | undefined
>;
```

---

## 🛠️ Developer Tools

Import from the separate entry so the UI and its CSS never reach production bundles.

### `DevToolContainer`

A floating inspector to visualize all active stores and their state in real-time.

```typescript
function DevToolContainer(props: {
  toggleButton?: string;
  Component?: DataViewComponent;
  children?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element
```

#### Props
- **`Component`** *(Component, optional)*: Custom renderer for state values, receives `{ name, value }`. Defaults to a JSON view.
- **`children`** *(ReactNode, optional)*: Custom trigger button content. Defaults to `"Toggle Dev Tool"`.
- Any other prop (`style`, `className`, ...) is forwarded to the trigger button, which is `position: fixed`. Use `style` to place it.

#### Example
```tsx
import { DevToolContainer } from 'react-state-custom/dev-tool';
import 'react-state-custom/style.css';

<DevToolContainer style={{ right: 20, bottom: 20 }} />
```

The entry also exports `DevToolState` (the panel without the toggle button), `StateView`, `DataViewDefault` and the `DataViewComponent` type.

---

## ⚙️ Advanced API (Primitives)

These APIs are used internally by `createStore`. You generally don't need them unless you're building custom abstractions.

### `createRootCtx`

Creates a headless "Root" component that runs a hook and publishes its result to a context.

```typescript
function createRootCtx<Params, State>(
  name: string,
  useFn: (params: Params, preState: Partial<State>) => State
): {
  Root: React.FC<Params>;
  useCtxState(params?: Params): Context<State>;       // logs an error if Root is not mounted
  useCtxStateStrict(params?: Params): Context<State>; // throws if Root is not mounted
  getCtxName(params: Params): string;
  name: string;
}
```

Mounting two `Root` components with the same name and params throws.

### `createAutoCtx`

Connects a `createRootCtx` result to the `AutoRootCtx` system for automatic mounting. `createStore` is `createAutoCtx(createRootCtx(name, useFn), options)`.

```typescript
function createAutoCtx<Params, State, Initial>(
  rootCtx: ReturnType<typeof createRootCtx<Params, State>>,
  options?: number | StoreOptions<Params, State, Initial>
): {
  useStore(params?: Params): StoreState<State, Initial>;
  useCtxState(params?: Params): Context<State>;
}
```

### `Context` / `getContext` / `useDataContext`

`Context<T>` is the pub/sub primitive behind every store: it holds `data` (the latest value per key) and emits an event per key on `publish`.

```typescript
class Context<T> extends EventTarget {
  readonly name: string;
  data: Partial<T>;
  publish<K extends keyof T>(key: K, value: T[K] | undefined): void;
}

function getContext<T>(name: string): Context<T>;      // memoized by name
function useDataContext<T>(name: string): Context<T>;  // hook form, scope-aware and ref-counted
```

`useDataContext` resolves the name inside the current `StateScopeProvider`, keeps the instance alive while mounted, and lets it be evicted shortly after the last user unmounts. On the server it returns a throwaway instance.

### `useDataSource` / `useDataSourceMultiple`

Hooks to publish values from a component into a context. Publishing happens in a layout effect; a key that stops being passed to `useDataSourceMultiple` is published as `undefined` and removed.

```typescript
useDataSource(ctx, 'key', value);
useDataSourceMultiple(ctx, ['key1', value1], ['key2', value2]);
```

### `useDataSubscribe` / `useDataSubscribeMultiple`

Hooks to subscribe to specific context keys. Built on `useSyncExternalStore`.

```typescript
const value = useDataSubscribe(ctx, 'key');
const value = useDataSubscribe(ctx, 'key', 100);              // debounced 100ms
const { key1, key2 } = useDataSubscribeMultiple(ctx, 'key1', 'key2');
const [key1, key2] = useDataSubscribeMultipleWithDebounce(ctx, 50, 'key1', 'key2');
```

### `useDataSubscribeWithTransform`

Subscribes to one key and re-renders only when the transformed value changes.

```typescript
const count = useDataSubscribeWithTransform(ctx, 'items', items => items?.length ?? 0);
```

### `useQuickSubscribe`

The proxy behind `useStore`. Returns an object whose property reads during render are turned into subscriptions.

```typescript
const { a, b } = useQuickSubscribe(ctx); // re-renders only when a or b changes
```

### `paramsToId`

Serializes a params object into the deterministic id used in store names (sorted keys, URI-encoded values).

```typescript
paramsToId({ b: 2, a: 'x y' }); // "a=x%20y&b=2"
```

### `useArrayChangeId`

Returns a string that changes whenever any element of the array changes (`Object.is`). Used by `useDataSourceMultiple` to batch publishes.
