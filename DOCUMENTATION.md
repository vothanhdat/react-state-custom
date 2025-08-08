# React State Custom

A powerful React library for advanced state management with context-based data sharing, automatic subscriptions, and efficient re-rendering optimization.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Core Classes](#core-classes)
    - [Context](#context)
  - [Context Management](#context-management)
    - [getContext](#getcontext)
    - [useDataContext](#usedatacontext)
  - [Data Sources](#data-sources)
    - [useDataSource](#usedatasource)
    - [useDataSourceMultiple](#usedatasourcemultiple)
  - [Data Subscriptions](#data-subscriptions)
    - [useDataSubscribe](#usedatasubscribe)
    - [useDataSubscribeMultiple](#usedatasubscribemultiple)
    - [useDataSubscribeMultipleWithDebounce](#usedatasubscribemultiplewithdebounce)
    - [useDataSubscribeWithTransform](#usedatasubscribewithtransform)
  - [Root Context Management](#root-context-management)
    - [createRootCtx](#createrootctx)
  - [Auto Context Management](#auto-context-management)
    - [AutoRootCtx](#autorootctx)
    - [createAutoCtx](#createautoctx)
  - [Advanced Subscriptions](#advanced-subscriptions)
    - [useQuickSubscribe](#usequicksubscribe)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [TypeScript Support](#typescript-support)

## Installation

```bash
npm install react-state-custom
# or
yarn add react-state-custom
```

## Quick Start

```tsx
import React from 'react';
import { useDataContext, useDataSource, useDataSubscribe } from 'react-state-custom';

// Define your data shape
interface AppData {
  counter: number;
  userName: string;
}

// Component that provides data
const DataProvider: React.FC = () => {
  const ctx = useDataContext<AppData>('app-context');
  
  // Provide data to the context
  useDataSource(ctx, 'counter', 0);
  useDataSource(ctx, 'userName', 'John Doe');
  
  return null;
};

// Component that consumes data
const DataConsumer: React.FC = () => {
  const ctx = useDataContext<AppData>('app-context');
  
  // Subscribe to specific data
  const counter = useDataSubscribe(ctx, 'counter');
  const userName = useDataSubscribe(ctx, 'userName');
  
  return (
    <div>
      <p>Counter: {counter}</p>
      <p>User: {userName}</p>
    </div>
  );
};

// App component
const App: React.FC = () => {
  return (
    <>
      <DataProvider />
      <DataConsumer />
    </>
  );
};
```

## API Reference

### Core Classes

#### Context

A generic context class for managing shared state and event subscriptions.

**Type Parameters:**
- `D` - The shape of the data managed by the context

**Constructor:**
```typescript
constructor(name: string)
```

**Properties:**
- `name: string` - The context name (for debugging)
- `data: Partial<D>` - The current data held by the context
- `registry: Set<string>` - Registry for tracking active keys

**Methods:**

##### publish
Publishes a value to the context and notifies subscribers if it changed.

```typescript
publish(key: keyof D, value: D[typeof key] | undefined): void
```

**Parameters:**
- `key` - The key to update
- `value` - The new value

**Example:**
```typescript
const ctx = new Context<{count: number}>('my-context');
ctx.publish('count', 5); // Updates count and notifies subscribers
```

##### subscribe
Subscribes to changes for a specific key in the context.

```typescript
subscribe(key: keyof D, listener: (value: D[typeof key] | undefined) => void): () => void
```

**Parameters:**
- `key` - The key to subscribe to
- `listener` - Callback invoked with the new value

**Returns:**
- Unsubscribe function

**Example:**
```typescript
const unsubscribe = ctx.subscribe('count', (newValue) => {
  console.log('Count changed to:', newValue);
});

// Later...
unsubscribe(); // Stop listening
```

### Context Management

#### getContext

Gets or creates a memoized Context instance by name.

```typescript
function getContext(name: string): Context<any>
```

**Parameters:**
- `name` - The context name

**Returns:**
- The Context instance

**Example:**
```typescript
const ctx = getContext('my-app-context');
ctx.publish('someKey', 'someValue');
```

#### useDataContext

React hook to get a typed Context instance by name.

```typescript
function useDataContext<D>(name?: string): Context<D>
```

**Type Parameters:**
- `D` - The data shape type

**Parameters:**
- `name` - The context name (defaults to "noname")

**Returns:**
- The typed Context instance

**Example:**
```typescript
interface MyData {
  userId: string;
  preferences: object;
}

const MyComponent: React.FC = () => {
  const ctx = useDataContext<MyData>('user-context');
  
  // ctx is now typed as Context<MyData>
  return <div>...</div>;
};
```

### Data Sources

#### useDataSource

React hook to publish a value to the context when it changes.

```typescript
function useDataSource<D, K extends keyof D>(
  ctx: Context<D> | undefined,
  key: K,
  value: D[K] | undefined
): void
```

**Type Parameters:**
- `D` - The data shape type
- `K` - The key type

**Parameters:**
- `ctx` - The context instance
- `key` - The key to update
- `value` - The new value

**Example:**
```typescript
const UserProvider: React.FC<{userId: string}> = ({userId}) => {
  const ctx = useDataContext<{userId: string}>('user-context');
  
  // Automatically publishes userId whenever it changes
  useDataSource(ctx, 'userId', userId);
  
  return null;
};
```

#### useDataSourceMultiple

React hook to publish multiple values to the context.

```typescript
function useDataSourceMultiple<D, T extends readonly (keyof D)[]>(
  ctx: Context<D> | undefined,
  ...entries: { -readonly [P in keyof T]: [T[P], D[T[P]]] }
): void
```

**Parameters:**
- `ctx` - The context instance
- `entries` - Array of [key, value] pairs to update

**Example:**
```typescript
const AppProvider: React.FC = () => {
  const ctx = useDataContext<{theme: string; language: string}>('app-context');
  
  // Publish multiple values at once
  useDataSourceMultiple(
    ctx,
    ['theme', 'dark'],
    ['language', 'en']
  );
  
  return null;
};
```

### Data Subscriptions

#### useDataSubscribe

React hook to subscribe to a context value, with optional debounce.

```typescript
function useDataSubscribe<D, K extends keyof D>(
  ctx: Context<D> | undefined,
  key: K,
  debounceTime?: number
): D[K] | undefined
```

**Type Parameters:**
- `D` - The data shape type
- `K` - The key type

**Parameters:**
- `ctx` - The context instance
- `key` - The key to subscribe to
- `debounceTime` - Debounce time in ms (default 0)

**Returns:**
- The current value for the key

**Example:**
```typescript
const UserDisplay: React.FC = () => {
  const ctx = useDataContext<{userName: string}>('user-context');
  
  // Subscribe to userName changes
  const userName = useDataSubscribe(ctx, 'userName');
  
  // Subscribe with debounce (useful for expensive operations)
  const userNameDebounced = useDataSubscribe(ctx, 'userName', 300);
  
  return <div>Hello, {userName}!</div>;
};
```

#### useDataSubscribeMultiple

React hook to subscribe to multiple context values.

```typescript
function useDataSubscribeMultiple<D, K extends keyof D>(
  ctx: Context<D> | undefined,
  ...keys: K[]
): Pick<D, K>
```

**Type Parameters:**
- `D` - The data shape type
- `K` - The key type

**Parameters:**
- `ctx` - The context instance
- `keys` - Keys to subscribe to

**Returns:**
- An object with the current values for the keys

**Example:**
```typescript
const UserProfile: React.FC = () => {
  const ctx = useDataContext<{name: string; email: string; age: number}>('user-context');
  
  // Subscribe to multiple values efficiently
  const {name, email, age} = useDataSubscribeMultiple(ctx, 'name', 'email', 'age');
  
  return (
    <div>
      <h1>{name}</h1>
      <p>Email: {email}</p>
      <p>Age: {age}</p>
    </div>
  );
};
```

#### useDataSubscribeMultipleWithDebounce

React hook to subscribe to multiple context values with throttling.

```typescript
function useDataSubscribeMultipleWithDebounce<D, K extends (keyof D)[]>(
  ctx: Context<D> | undefined,
  debounceTime?: number,
  ...keys: K
): { [i in keyof K]: D[K[i]] | undefined }
```

**Type Parameters:**
- `D` - The data shape type
- `K` - The keys array type

**Parameters:**
- `ctx` - The context instance
- `debounceTime` - Throttle time in ms (default 100)
- `keys` - Keys to subscribe to

**Returns:**
- Array of current values for the keys

**Example:**
```typescript
const SearchResults: React.FC = () => {
  const ctx = useDataContext<{query: string; filters: object; results: any[]}>('search-context');
  
  // Subscribe with throttling for better performance
  const [query, filters, results] = useDataSubscribeMultipleWithDebounce(
    ctx,
    200, // 200ms throttle
    'query',
    'filters', 
    'results'
  );
  
  return (
    <div>
      <p>Searching for: {query}</p>
      <p>Results: {results?.length || 0}</p>
    </div>
  );
};
```

#### useDataSubscribeWithTransform

React hook to subscribe to a context value and transform it before returning.

```typescript
function useDataSubscribeWithTransform<D, K extends keyof D, E>(
  ctx: Context<D> | undefined,
  key: K,
  transform: (value: D[K] | undefined) => E
): E
```

**Type Parameters:**
- `D` - The data shape type
- `K` - The key type
- `E` - The transformed value type

**Parameters:**
- `ctx` - The context instance
- `key` - The key to subscribe to
- `transform` - Function to transform the value

**Returns:**
- The transformed value

**Example:**
```typescript
const FormattedPrice: React.FC = () => {
  const ctx = useDataContext<{price: number}>('product-context');
  
  // Transform price to formatted string
  const formattedPrice = useDataSubscribeWithTransform(
    ctx,
    'price',
    (price) => price ? `$${price.toFixed(2)}` : 'N/A'
  );
  
  return <span>{formattedPrice}</span>;
};
```

### Root Context Management

#### createRootCtx

Creates a root context manager with automatic state management and lifecycle tracking.

```typescript
function createRootCtx<U extends object, V extends object>(
  name: string,
  useFn: (params: U) => V
): {
  resolveCtxName: (params: U) => string;
  Root: React.FC<U>;
  useCtxStateStrict: (params: U) => Context<V>;
  useCtxState: (params: U) => Context<V>;
}
```

**Type Parameters:**
- `U` - The input parameters type
- `V` - The output state type

**Parameters:**
- `name` - Base name for the context
- `useFn` - Function that converts input parameters to state

**Returns:**
- Object with root component and context hooks

**Example:**
```typescript
interface UserParams {
  userId: string;
}

interface UserState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

const useUserState = (params: UserParams): UserState => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchUserProfile(params.userId)
      .then(setProfile)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.userId]);
  
  return { profile, loading, error };
};

const { Root: UserStateProvider, useCtxState } = createRootCtx(
  'user-state',
  useUserState
);

// Usage
const App: React.FC = () => {
  return (
    <>
      <UserStateProvider userId="123" />
      <UserComponent userId="123" />
    </>
  );
};

const UserComponent: React.FC<{userId: string}> = ({userId}) => {
  const ctx = useCtxState({userId});
  const profile = useDataSubscribe(ctx, 'profile');
  const loading = useDataSubscribe(ctx, 'loading');
  
  if (loading) return <div>Loading...</div>;
  return <div>Welcome, {profile?.name}!</div>;
};
```

### Auto Context Management

#### AutoRootCtx

A component that automatically manages mounting and unmounting of root contexts.

```typescript
const AutoRootCtx: React.FC<{Wrapper?: React.ComponentType}> = ({Wrapper})
```

**Props:**
- `Wrapper` - Optional wrapper component (defaults to React.Fragment)

**Example:**
```typescript
const App: React.FC = () => {
  return (
    <AutoRootCtx Wrapper={({children}) => <div className="app">{children}</div>}>
      {/* Your app content */}
    </AutoRootCtx>
  );
};
```

#### createAutoCtx

Creates an auto-managed context that automatically mounts/unmounts root providers.

```typescript
function createAutoCtx<U extends object, V extends object>(
  rootCtx: ReturnType<typeof createRootCtx<U, V>>
): {
  useCtxState: (params: U) => Context<V>;
}
```

**Parameters:**
- `rootCtx` - The root context created by createRootCtx

**Returns:**
- Object with auto-managed context hook

**Example:**
```typescript
const { Root, useCtxState: useManualCtxState } = createRootCtx('user', useUserState);
const { useCtxState: useAutoCtxState } = createAutoCtx({ Root, useCtxState: useManualCtxState });

// In your app root
const AppRoot: React.FC = () => {
  return (
    <AutoRootCtx>
      <UserComponent userId="123" />
    </AutoRootCtx>
  );
};

// Component automatically gets access to context
const UserComponent: React.FC<{userId: string}> = ({userId}) => {
  // Context is automatically mounted/unmounted as needed
  const ctx = useAutoCtxState({userId});
  const profile = useDataSubscribe(ctx, 'profile');
  
  return <div>{profile?.name}</div>;
};
```

### Advanced Subscriptions

#### useQuickSubscribe

Advanced hook that provides proxy-based access to context data with automatic subscription management.

```typescript
function useQuickSubscribe<D>(
  ctx: Context<D> | undefined
): { [P in keyof D]?: D[P] | undefined }
```

**Type Parameters:**
- `D` - The data shape type

**Parameters:**
- `ctx` - The context instance

**Returns:**
- Proxy object that automatically subscribes to accessed properties

**Example:**
```typescript
const SmartComponent: React.FC = () => {
  const ctx = useDataContext<{
    user: User;
    posts: Post[];
    notifications: Notification[];
  }>('app-context');
  
  // Get proxy that auto-subscribes to accessed properties
  const data = useQuickSubscribe(ctx);
  
  // Only subscribes to 'user' and 'posts', not 'notifications'
  return (
    <div>
      <h1>Welcome, {data.user?.name}</h1>
      <p>You have {data.posts?.length} posts</p>
    </div>
  );
};
```

## Examples

### Basic Counter Example

```tsx
import React, { useState } from 'react';
import { useDataContext, useDataSource, useDataSubscribe } from 'react-state-custom';

interface CounterData {
  count: number;
}

const CounterProvider: React.FC = () => {
  const [count, setCount] = useState(0);
  const ctx = useDataContext<CounterData>('counter');
  
  useDataSource(ctx, 'count', count);
  
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  
  return (
    <div>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
};

const CounterDisplay: React.FC = () => {
  const ctx = useDataContext<CounterData>('counter');
  const count = useDataSubscribe(ctx, 'count');
  
  return <div>Count: {count}</div>;
};

const CounterApp: React.FC = () => {
  return (
    <div>
      <CounterProvider />
      <CounterDisplay />
    </div>
  );
};
```

### Todo List with Auto Context

```tsx
import React, { useState, useCallback } from 'react';
import { createRootCtx, createAutoCtx, AutoRootCtx, useDataSubscribe } from 'react-state-custom';

interface TodoParams {
  listId: string;
}

interface TodoState {
  todos: Todo[];
  loading: boolean;
}

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

const useTodoState = (params: TodoParams): TodoState => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  
  const addTodo = useCallback((text: string) => {
    const newTodo: Todo = {
      id: Date.now().toString(),
      text,
      completed: false
    };
    setTodos(prev => [...prev, newTodo]);
  }, []);
  
  const toggleTodo = useCallback((id: string) => {
    setTodos(prev => prev.map(todo => 
      todo.id === id ? {...todo, completed: !todo.completed} : todo
    ));
  }, []);
  
  return { todos, loading };
};

const { Root: TodoStateProvider, useCtxState: useManualTodoCtx } = createRootCtx(
  'todo-state',
  useTodoState
);

const { useCtxState: useTodoCtx } = createAutoCtx({
  Root: TodoStateProvider,
  useCtxState: useManualTodoCtx
});

const TodoList: React.FC<{listId: string}> = ({listId}) => {
  const ctx = useTodoCtx({listId});
  const todos = useDataSubscribe(ctx, 'todos');
  const loading = useDataSubscribe(ctx, 'loading');
  
  if (loading) return <div>Loading todos...</div>;
  
  return (
    <ul>
      {todos?.map(todo => (
        <li key={todo.id} style={{textDecoration: todo.completed ? 'line-through' : 'none'}}>
          {todo.text}
        </li>
      ))}
    </ul>
  );
};

const TodoApp: React.FC = () => {
  return (
    <AutoRootCtx>
      <div>
        <h1>My Todos</h1>
        <TodoList listId="main" />
      </div>
    </AutoRootCtx>
  );
};
```

## Best Practices

### 1. Type Safety

Always use TypeScript interfaces to define your data shapes:

```typescript
interface AppState {
  user: User | null;
  theme: 'light' | 'dark';
  notifications: Notification[];
}

const ctx = useDataContext<AppState>('app');
```

### 2. Context Naming

Use descriptive, unique names for your contexts:

```typescript
// Good
const userCtx = useDataContext<UserData>('user-profile-data');
const cartCtx = useDataContext<CartData>('shopping-cart-state');

// Avoid
const ctx1 = useDataContext('ctx');
const ctx2 = useDataContext('data');
```

### 3. Debouncing for Performance

Use debouncing for frequently changing data:

```typescript
// For search input
const searchQuery = useDataSubscribe(ctx, 'query', 300);

// For multiple rapid updates
const [query, results] = useDataSubscribeMultipleWithDebounce(
  ctx,
  200,
  'query',
  'results'
);
```

### 4. Auto Context for Complex State

Use auto context management for complex, parameterized state:

```typescript
// Instead of manual context management
const { Root, useCtxState } = createRootCtx('user', useUserState);
const { useCtxState: useAutoUserCtx } = createAutoCtx({ Root, useCtxState });

// Components can request user state on-demand
const UserProfile: React.FC<{userId: string}> = ({userId}) => {
  const ctx = useAutoUserCtx({userId}); // Automatically mounts/unmounts
  // ...
};
```

### 5. Memory Management

Clean up subscriptions properly (hooks handle this automatically):

```typescript
useEffect(() => {
  const unsubscribe = ctx.subscribe('key', handler);
  return unsubscribe; // Always return cleanup function
}, []);
```

## TypeScript Support

This library is built with TypeScript and provides full type safety:

- **Generic Context**: `Context<DataShape>` ensures type safety for keys and values
- **Typed Hooks**: All hooks infer types from the context and key parameters
- **Transform Types**: `useDataSubscribeWithTransform` preserves transformed types
- **Parameter Validation**: createRootCtx validates parameter and state shapes

```typescript
// Full type inference
interface UserData {
  id: string;
  name: string;
  age: number;
}

const ctx = useDataContext<UserData>('user');

// TypeScript knows these are the correct types
const name: string | undefined = useDataSubscribe(ctx, 'name');
const id: string | undefined = useDataSubscribe(ctx, 'id');
const age: number | undefined = useDataSubscribe(ctx, 'age');

// TypeScript error - 'invalidKey' doesn't exist on UserData
// const invalid = useDataSubscribe(ctx, 'invalidKey');
```

---

This documentation covers all exported functionality from react-state-custom. For more advanced usage patterns and examples, refer to the source code and test files in the repository.