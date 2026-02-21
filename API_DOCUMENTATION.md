# API Reference

Complete documentation for the `react-state-custom` API.

> **Note:** For most applications, you only need `createStore` and `AutoRootCtx`. The other APIs are lower-level primitives used internally or for advanced customization.

---

## ⚡ Primary API

### `createStore`

The main entry point. Converts a standard React hook into a shared, auto-managed store.

```typescript
function createStore<Params, State>(
  name: string,
  useFn: (params: Params, preState: Partial<State>) => State,
  timeToClean?: number,
  AttachedComponent?: React.FC<Params>
): {
  useStore(params: Params): State;
  useCtxState(params: Params): Context<State>;
}
```

#### Arguments
- **`name`** *(string)*: A unique namespace for this store (e.g., `'user'`, `'cart'`).
- **`useFn`** *(function)*: Your custom hook. Receives `params` and optional `preState`.
- **`timeToClean`** *(number, optional)*: Time in milliseconds to keep the store alive after the last subscriber unmounts. Defaults to `0`.
- **`AttachedComponent`** *(Component, optional)*: A React component that renders alongside the store root. Useful for side effects (like data fetching or logging) that should run exactly once per store instance.

#### Returns
- **`useStore`**: The consumer hook. Call this in your components to read state. It returns a **proxy** that automatically tracks which properties you access to optimize re-renders.
- **`useCtxState`**: Returns the raw `Context` object. Useful for advanced integrations.

#### Example
```tsx
const useCounter = ({ initial }) => {
  const [count, setCount] = useState(initial);
  return { count, setCount };
};

export const { useStore } = createStore('counter', useCounter);
```

---

### `AutoRootCtx`

The global manager component. Must be mounted once at the top of your application.

```typescript
function AutoRootCtx(props: {
  Wrapper?: React.FC<{ children: React.ReactNode }>;
  debugging?: boolean;
}): JSX.Element
```

#### Props
- **`Wrapper`** *(Component, optional)*: A wrapper component for each store instance (e.g., an ErrorBoundary). Defaults to `React.Fragment`.
- **`debugging`** *(boolean, optional)*: If `true`, renders a raw view of the state in the DOM for debugging.

#### Example
```tsx
function App() {
  return (
    <>
      <AutoRootCtx Wrapper={ErrorBoundary} />
      <Routes />
    </>
  );
}
```

---

## 🛠️ Developer Tools

### `DevToolContainer`

A floating inspector to visualize all active stores and their state in real-time.

```typescript
function DevToolContainer(props: {
  toggleButton?: string;
  Component?: DataViewComponent;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}): JSX.Element
```

#### Props
- **`toggleButton`** *(string, optional)*: Text for the toggle button.
- **`Component`** *(Component, optional)*: Custom renderer for state values. Defaults to a JSON tree view.
- **`children`** *(ReactNode, optional)*: Custom trigger button content.

#### Example
```tsx
import { DevToolContainer } from 'react-state-custom';
import 'react-state-custom/dist/react-state-custom.css';

<DevToolContainer />
```

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
  useCtxState(params: Params): Context<State>;
  // ...other internal helpers
}
```

### `createAutoCtx`

Connects a `createRootCtx` result to the `AutoRootCtx` system for automatic mounting.

```typescript
function createAutoCtx(
  rootCtx: ReturnType<typeof createRootCtx>,
  timeToClean?: number,
  AttachedComponent?: React.FC
): Result
```

### `useDataContext`

Hook to retrieve a `Context` instance by name.

```typescript
function useDataContext<T>(name: string): Context<T>
```

### `useDataSource` / `useDataSourceMultiple`

Hooks to publish values from a component into a context.

```typescript
useDataSource(ctx, 'key', value);
useDataSourceMultiple(ctx, ['key1', value1], ['key2', value2]);
```

### `useDataSubscribe` / `useDataSubscribeMultiple`

Hooks to manually subscribe to specific context keys.

```typescript
const value = useDataSubscribe(ctx, 'key');
const { key1, key2 } = useDataSubscribeMultiple(ctx, 'key1', 'key2');
```

---

## 🧩 Types

### `ParamsToIdRecord`

Constraint for store parameters. All params must be primitive values to ensure deterministic IDs.

```typescript
type ParamsToIdRecord = Record<
  string,
  string | number | bigint | boolean | null | undefined
>;
```
