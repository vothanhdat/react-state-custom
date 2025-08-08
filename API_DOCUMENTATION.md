# React State Custom - API Documentation

A powerful React library for managing shared state and context with TypeScript support, built with Vite.

## Table of Contents

1. [Core Context System](#core-context-system)
   - [Context Class](#context-class)
   - [getContext](#getcontext)
   - [useDataContext](#usedatacontext)
2. [Data Source Hooks](#data-source-hooks)
   - [useDataSource](#usedatasource)
   - [useDataSourceMultiple](#usedatasourcemultiple)
3. [Data Subscription Hooks](#data-subscription-hooks)
   - [useDataSubscribe](#usedatasubscribe)
   - [useDataSubscribeMultiple](#usedatasubscribemultiple)
   - [useDataSubscribeMultipleWithDebounce](#usedatasubscribemultiplewithbounce)
   - [useDataSubscribeWithTransform](#usedatasubscribewithtransform)
4. [Root Context Factory](#root-context-factory)
   - [createRootCtx](#createrootctx)
5. [Auto Context System](#auto-context-system)
   - [AutoRootCtx](#autorootctx)
   - [createAutoCtx](#createautoctx)
6. [Utility Hooks](#utility-hooks)
   - [useArrayHash](#usearrayhash)
   - [useQuickSubscribe](#usequicksubscribe)
7. [Usage Patterns](#usage-patterns)
8. [Examples](#examples)

---

## Core Context System

### Context Class

A generic context class for managing shared state and event subscriptions.

**Type Definition:**
```typescript
class Context<D> {
  constructor(name: string)
  data: Partial<D>
  registry: Set<string>
  publish(key: keyof D, value: D[typeof key] | undefined): void
  subscribe(key: keyof D, listener: (e: D[typeof key] | undefined) => void): () => void
}
```

**Parameters:**
- `D` - The shape of the data managed by the context

**Properties:**
- `name` - The name of the context (for debugging)
- `data` - The current data held by the context
- `registry` - Registry for tracking active keys

**Methods:**
- `publish(key, value)` - Publish a value to the context and notify subscribers if it changed
- `subscribe(key, listener)` - Subscribe to changes for a specific key, returns unsubscribe function

**Example:**
```typescript
interface UserData {
  name: string;
  age: number;
  email: string;
}

const userContext = new Context<UserData>('user-context');

// Subscribe to changes
const unsubscribe = userContext.subscribe('name', (newName) => {
  console.log('Name changed to:', newName);
});

// Publish data
userContext.publish('name', 'John Doe');
userContext.publish('age', 30);

// Cleanup
unsubscribe();
```

---

### getContext

Get or create a memoized Context instance by name.

**Type Definition:**
```typescript
function getContext(name: string): Context<any>
```

**Parameters:**
- `name` - The context name

**Returns:**
- The Context instance (memoized by name)

**Example:**
```typescript
const userCtx = getContext('user-context');
const settingsCtx = getContext('settings-context');

// Same name returns the same instance
const userCtx2 = getContext('user-context');
console.log(userCtx === userCtx2); // true
```

---

### useDataContext

React hook to get a typed Context instance by name.

**Type Definition:**
```typescript
function useDataContext<D>(name?: string): Context<D>
```

**Parameters:**
- `name` - The context name (default: "noname")

**Returns:**
- The typed Context instance

**Example:**
```typescript
interface AppState {
  user: User;
  theme: 'light' | 'dark';
  isLoading: boolean;
}

function MyComponent() {
  const ctx = useDataContext<AppState>('app-state');
  
  // Now ctx is typed as Context<AppState>
  return <div>Context ready</div>;
}
```

---

## Data Source Hooks

### useDataSource

React hook to publish a value to the context when it changes.

**Type Definition:**
```typescript
function useDataSource<D, K extends keyof D>(
  ctx: Context<D> | undefined,
  key: K,
  value: D[K] | undefined
): void
```

**Parameters:**
- `ctx` - The context instance
- `key` - The key to update
- `value` - The new value

**Example:**
```typescript
interface UserState {
  profile: UserProfile;
  preferences: UserPreferences;
}

function UserProvider({ userId }: { userId: string }) {
  const ctx = useDataContext<UserState>('user-state');
  const userProfile = useFetchUserProfile(userId);
  const userPreferences = useFetchUserPreferences(userId);
  
  // Automatically publish to context when values change
  useDataSource(ctx, 'profile', userProfile);
  useDataSource(ctx, 'preferences', userPreferences);
  
  return <>{children}</>;
}
```

---

### useDataSourceMultiple

React hook to publish multiple values to the context.

**Type Definition:**
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
function AppProvider() {
  const ctx = useDataContext<AppState>('app-state');
  const user = useCurrentUser();
  const theme = useTheme();
  const isLoading = useLoadingState();
  
  // Publish multiple values at once
  useDataSourceMultiple(ctx,
    ['user', user],
    ['theme', theme],
    ['isLoading', isLoading]
  );
  
  return <>{children}</>;
}
```

---

## Data Subscription Hooks

### useDataSubscribe

React hook to subscribe to a context value, with optional debounce.

**Type Definition:**
```typescript
function useDataSubscribe<D, K extends keyof D>(
  ctx: Context<D> | undefined,
  key: K,
  debounceTime?: number
): D[K] | undefined
```

**Parameters:**
- `ctx` - The context instance
- `key` - The key to subscribe to
- `debounceTime` - Debounce time in ms (default: 0)

**Returns:**
- The current value for the key

**Example:**
```typescript
function UserProfile() {
  const ctx = useDataContext<UserState>('user-state');
  
  // Subscribe to user profile changes
  const profile = useDataSubscribe(ctx, 'profile');
  
  // Subscribe with debouncing for frequently changing data
  const searchQuery = useDataSubscribe(ctx, 'searchQuery', 300);
  
  if (!profile) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>{profile.name}</h1>
      <p>{profile.email}</p>
    </div>
  );
}
```

---

### useDataSubscribeMultiple

React hook to subscribe to multiple context values.

**Type Definition:**
```typescript
function useDataSubscribeMultiple<D, K extends keyof D>(
  ctx: Context<D> | undefined,
  ...keys: K[]
): Pick<D, K>
```

**Parameters:**
- `ctx` - The context instance
- `keys` - Keys to subscribe to

**Returns:**
- An object with the current values for the keys

**Example:**
```typescript
function Dashboard() {
  const ctx = useDataContext<AppState>('app-state');
  
  // Subscribe to multiple values
  const { user, theme, isLoading } = useDataSubscribeMultiple(
    ctx, 
    'user', 
    'theme', 
    'isLoading'
  );
  
  return (
    <div className={`dashboard ${theme}`}>
      {isLoading && <Spinner />}
      <h1>Welcome, {user?.name}</h1>
    </div>
  );
}
```

---

### useDataSubscribeMultipleWithDebounce

React hook to subscribe to multiple context values with throttling.

**Type Definition:**
```typescript
function useDataSubscribeMultipleWithDebounce<D, K extends (keyof D)[]>(
  ctx: Context<D> | undefined,
  debounceTime?: number,
  ...keys: K
): { [i in keyof K]: D[K[i]] | undefined }
```

**Parameters:**
- `ctx` - The context instance
- `debounceTime` - Debounce time in ms (default: 50)
- `keys` - Keys to subscribe to

**Returns:**
- Array of current values for the keys

**Example:**
```typescript
function SearchResults() {
  const ctx = useDataContext<SearchState>('search-state');
  
  // Subscribe with debouncing for performance
  const [query, filters, sortBy] = useDataSubscribeMultipleWithDebounce(
    ctx,
    200, // 200ms debounce
    'query',
    'filters', 
    'sortBy'
  );
  
  const results = useSearchResults(query, filters, sortBy);
  
  return <ResultsList results={results} />;
}
```

---

### useDataSubscribeWithTransform

React hook to subscribe to a context value and transform it before returning.

**Type Definition:**
```typescript
function useDataSubscribeWithTransform<D, K extends keyof D, E>(
  ctx: Context<D> | undefined,
  key: K,
  transform: (e: D[K] | undefined) => E
): E
```

**Parameters:**
- `ctx` - The context instance
- `key` - The key to subscribe to
- `transform` - Function to transform the value

**Returns:**
- The transformed value

**Example:**
```typescript
function UserStats() {
  const ctx = useDataContext<UserState>('user-state');
  
  // Transform user data to display stats
  const userStats = useDataSubscribeWithTransform(
    ctx,
    'profile',
    (profile) => ({
      totalPosts: profile?.posts?.length || 0,
      joinedDate: profile?.createdAt ? new Date(profile.createdAt) : null,
      isVerified: profile?.verified || false
    })
  );
  
  return (
    <div>
      <p>Posts: {userStats.totalPosts}</p>
      <p>Joined: {userStats.joinedDate?.toLocaleDateString()}</p>
      {userStats.isVerified && <Badge>Verified</Badge>}
    </div>
  );
}
```

---

## Root Context Factory

### createRootCtx

Factory that creates a headless "Root" component and companion hooks for a context namespace.

**Type Definition:**
```typescript
function createRootCtx<U extends object, V extends object>(
  name: string,
  useFn: (e: U) => V
): {
  Root: React.FC<U>;
  useCtxState: (e: U) => Context<V>;
  useCtxStateStrict: (e: U) => Context<V>;
  resolveCtxName: (e: U) => string;
}
```

**Parameters:**
- `name` - Base name for the context
- `useFn` - Hook function that computes state from props

**Returns:**
- `Root` - Component to mount for providing the context
- `useCtxState` - Lenient consumer hook
- `useCtxStateStrict` - Strict consumer hook (throws if Root not mounted)
- `resolveCtxName` - Function to resolve context name from props

**Example:**
```typescript
// Define your state hook
function useUserState(props: { userId: string }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchUser(props.userId).then(user => {
      setUser(user);
      setLoading(false);
    });
  }, [props.userId]);
  
  return { user, loading };
}

// Create the root context
const { Root: UserRoot, useCtxState: useUserCtxState } = createRootCtx(
  'user-state',
  useUserState
);

// Provider component
function UserProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  return (
    <>
      <UserRoot userId={userId} />
      {children}
    </>
  );
}

// Consumer component
function UserProfile({ userId }: { userId: string }) {
  const ctx = useUserCtxState({ userId });
  const { user, loading } = useDataSubscribeMultiple(ctx, 'user', 'loading');
  
  if (loading) return <div>Loading...</div>;
  
  return <div>Hello, {user?.name}</div>;
}
```

---

## Auto Context System

### AutoRootCtx

Component for automatic context management. Mount once at the app root to enable automatic Root instance management.

**Type Definition:**
```typescript
function AutoRootCtx({ Wrapper }: { 
  Wrapper?: React.ComponentType<{ children: React.ReactNode }> 
}): JSX.Element
```

**Parameters:**
- `Wrapper` - Optional wrapper component (should act like ErrorBoundary)

**Example:**
```typescript
// At your app root
function App() {
  return (
    <AutoRootCtx Wrapper={ErrorBoundary}>
      <Router>
        <Routes>
          <Route path="/user/:id" element={<UserPage />} />
        </Routes>
      </Router>
    </AutoRootCtx>
  );
}

// ErrorBoundary wrapper
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  // Your error boundary logic
  return <>{children}</>;
}
```

---

### createAutoCtx

Bridges a Root context (from createRootCtx) to the global AutoRootCtx renderer.

**Type Definition:**
```typescript
function createAutoCtx<U extends object, V extends object>(
  rootContext: ReturnType<typeof createRootCtx<U, V>>
): {
  useCtxState: (e: U) => Context<V>;
}
```

**Parameters:**
- `rootContext` - Return value from createRootCtx

**Returns:**
- `useCtxState` - Hook that automatically manages Root instances

**Example:**
```typescript
// Create auto context from root context
const { useCtxState: useUserCtxStateAuto } = createAutoCtx(
  createRootCtx('user-state', useUserState)
);

// Usage - no need to manually mount Root components
function UserProfile({ userId }: { userId: string }) {
  // This automatically manages the Root instance
  const ctx = useUserCtxStateAuto({ userId });
  const { user, loading } = useDataSubscribeMultiple(ctx, 'user', 'loading');
  
  if (loading) return <div>Loading...</div>;
  
  return <div>Hello, {user?.name}</div>;
}
```

---

## Utility Hooks

### useArrayHash

A custom hook that computes a stable hash for an array of values.

**Type Definition:**
```typescript
function useArrayHash(e: any[]): string
```

**Parameters:**
- `e` - The input array to hash

**Returns:**
- A string hash that updates when the array changes

**Example:**
```typescript
function OptimizedComponent({ items }: { items: any[] }) {
  // Get stable hash for the array
  const itemsHash = useArrayHash(items);
  
  // Only recalculate when hash changes
  const processedItems = useMemo(() => {
    return items.map(item => expensiveProcessing(item));
  }, [itemsHash]);
  
  return <div>{processedItems.length} items processed</div>;
}
```

---

### useQuickSubscribe

Hook for efficiently subscribing to specific properties of a context's data object.

**Type Definition:**
```typescript
function useQuickSubscribe<D>(
  ctx: Context<D> | undefined
): { [P in keyof D]?: D[P] | undefined }
```

**Parameters:**
- `ctx` - The context object containing data and a subscribe method

**Returns:**
- A proxy object that mirrors the context data, automatically subscribing to accessed properties

**Example:**
```typescript
function UserComponent() {
  const ctx = useDataContext<UserState>('user-state');
  
  // Only subscribes to properties you actually access
  const { name, email } = useQuickSubscribe(ctx);
  // Accessing 'name' and 'email' will subscribe to changes in those properties only
  
  return (
    <div>
      <h1>{name}</h1>
      <p>{email}</p>
      {/* If you later access 'age', it will automatically subscribe to that too */}
    </div>
  );
}
```

---

## Usage Patterns

### Basic Context Usage

```typescript
// 1. Define your data interface
interface AppState {
  user: User | null;
  theme: 'light' | 'dark';
  notifications: Notification[];
}

// 2. Create and use context
function App() {
  const ctx = useDataContext<AppState>('app-state');
  
  // 3. Provide data
  const user = useCurrentUser();
  const theme = useTheme();
  useDataSource(ctx, 'user', user);
  useDataSource(ctx, 'theme', theme);
  
  return <AppContent />;
}

// 4. Consume data
function AppContent() {
  const ctx = useDataContext<AppState>('app-state');
  const { user, theme } = useDataSubscribeMultiple(ctx, 'user', 'theme');
  
  return <div className={`app ${theme}`}>Welcome, {user?.name}</div>;
}
```

### Advanced Root Context Pattern

```typescript
// 1. Create state hook
function useAppState(props: { initialTheme: string }) {
  const [theme, setTheme] = useState(props.initialTheme);
  const [user, setUser] = useState(null);
  
  return { theme, user, setTheme, setUser };
}

// 2. Create root context
const { Root: AppRoot, useCtxState } = createRootCtx('app', useAppState);

// 3. Provider pattern
function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppRoot initialTheme="light" />
      {children}
    </>
  );
}

// 4. Consumer hook
function useAppContext() {
  return useCtxState({ initialTheme: 'light' });
}
```

### Auto Context Pattern

```typescript
// 1. Setup auto context once
const { useCtxState: useAppState } = createAutoCtx(
  createRootCtx('app-auto', useAppStateLogic)
);

// 2. Mount AutoRootCtx at app root
function App() {
  return (
    <AutoRootCtx Wrapper={ErrorBoundary}>
      <MyApp />
    </AutoRootCtx>
  );
}

// 3. Use anywhere without manual Root mounting
function AnyComponent() {
  const ctx = useAppState({ config: 'production' });
  const data = useQuickSubscribe(ctx);
  
  return <div>{data.someProperty}</div>;
}
```

---

## Examples

### Complete Todo App Example

```typescript
// Types
interface TodoState {
  todos: Todo[];
  filter: 'all' | 'active' | 'completed';
  newTodoText: string;
}

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

// State hook
function useTodoState() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [newTodoText, setNewTodoText] = useState('');
  
  const addTodo = useCallback((text: string) => {
    const newTodo: Todo = {
      id: Date.now().toString(),
      text,
      completed: false
    };
    setTodos(prev => [...prev, newTodo]);
    setNewTodoText('');
  }, []);
  
  const toggleTodo = useCallback((id: string) => {
    setTodos(prev => prev.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  }, []);
  
  return {
    todos,
    filter,
    newTodoText,
    setFilter,
    setNewTodoText,
    addTodo,
    toggleTodo
  };
}

// Auto context setup
const { useCtxState: useTodoContext } = createAutoCtx(
  createRootCtx('todo-app', useTodoState)
);

// App component
function TodoApp() {
  return (
    <AutoRootCtx>
      <div className="todo-app">
        <TodoInput />
        <TodoList />
        <TodoFilters />
      </div>
    </AutoRootCtx>
  );
}

// Input component
function TodoInput() {
  const ctx = useTodoContext();
  const { newTodoText, addTodo, setNewTodoText } = useQuickSubscribe(ctx);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoText.trim()) {
      addTodo(newTodoText.trim());
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        value={newTodoText}
        onChange={(e) => setNewTodoText(e.target.value)}
        placeholder="Add a new todo..."
      />
      <button type="submit">Add</button>
    </form>
  );
}

// List component
function TodoList() {
  const ctx = useTodoContext();
  const { todos, filter } = useDataSubscribeMultiple(ctx, 'todos', 'filter');
  
  const filteredTodos = useMemo(() => {
    switch (filter) {
      case 'active':
        return todos.filter(todo => !todo.completed);
      case 'completed':
        return todos.filter(todo => todo.completed);
      default:
        return todos;
    }
  }, [todos, filter]);
  
  return (
    <ul className="todo-list">
      {filteredTodos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}

// Todo item component
function TodoItem({ todo }: { todo: Todo }) {
  const ctx = useTodoContext();
  const { toggleTodo } = useQuickSubscribe(ctx);
  
  return (
    <li className={`todo-item ${todo.completed ? 'completed' : ''}`}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => toggleTodo(todo.id)}
      />
      <span>{todo.text}</span>
    </li>
  );
}

// Filter component
function TodoFilters() {
  const ctx = useTodoContext();
  const { filter, setFilter } = useQuickSubscribe(ctx);
  
  return (
    <div className="todo-filters">
      {(['all', 'active', 'completed'] as const).map(filterType => (
        <button
          key={filterType}
          className={filter === filterType ? 'active' : ''}
          onClick={() => setFilter(filterType)}
        >
          {filterType}
        </button>
      ))}
    </div>
  );
}
```

This comprehensive documentation covers all exported APIs from the react-state-custom library with detailed descriptions, type information, and practical examples.