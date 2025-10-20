# React State Custom

**Simple. Powerful. TypeScript-first.**

A lightweight React state management library that combines the simplicity of React hooks with the power of event-driven subscriptions. No boilerplate, no complexity—just pure, performant state management.

```bash
npm install react-state-custom
```

## Why React State Custom?

**Zero Boilerplate** • **Type-Safe** • **Selective Re-renders** • **Hook-Based** • **~10KB Bundle**

React State Custom lets you write state management code that feels natural—because it **is** just React hooks. Use the same hooks you already know (`useState`, `useEffect`, etc.) to create powerful, shared state without learning new paradigms.

## ⚡ Quick Example

```typescript
import { createRootCtx, createAutoCtx, useQuickSubscribe, AutoRootCtx, DevToolContainer } from 'react-state-custom';

// 1. Write your state logic using familiar React hooks
function useCounterState() {
  const [count, setCount] = useState(0);
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  
  return { count, increment, decrement };
}

// 2. Create shared context (one line!)
const { useCtxState } = createAutoCtx(createRootCtx('counter', useCounterState));

// 3. Add AutoRootCtx to your app root
function App() {
  return (
    <>
      <AutoRootCtx />
      <Counter />
      {/* Optional: Add DevTools for debugging */}
      <DevToolContainer />
    </>
  );
}

// 4. Use anywhere in your app
function Counter() {
  const ctx = useCtxState();
  const { count, increment, decrement } = useQuickSubscribe(ctx);
  
  return (
    <div>
      <h1>{count}</h1>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}
```

**That's it!** No reducers, no actions, no providers to wrap—just hooks.

## 🎯 Key Features

### 1. **Just React Hooks**
Use `useState`, `useEffect`, `useMemo`, and any other React hooks you already know. No new concepts to learn.

```typescript
function useUserState({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchUser(userId).then(setUser).finally(() => setLoading(false));
  }, [userId]);
  
  return { user, loading };
}
```

### 2. **Selective Re-renders**
Components only re-render when the **specific data they subscribe to** changes—not when anything in the state changes.

```typescript
// Only re-renders when 'user' changes, not when 'loading' changes
const { user } = useDataSubscribeMultiple(ctx, 'user');

// Or subscribe to multiple fields
const { user, loading } = useDataSubscribeMultiple(ctx, 'user', 'loading');
```

### 3. **Automatic Context Management**
With `AutoRootCtx`, state contexts are automatically created and destroyed as needed. No manual provider management.

### 4. **TypeScript First**
Full type inference and type safety throughout. Your IDE knows exactly what's in your state.

### 5. **Tiny Bundle Size**
~10KB gzipped. No dependencies except React.

## 🆚 Comparison with Redux & Zustand

| Feature | React State Custom | Redux | Zustand |
|---------|-------------------|-------|---------|
| **Bundle Size** | ~10KB | ~50KB (with toolkit) | ~1KB |
| **Learning Curve** | ✅ Minimal (just hooks) | ❌ High (actions, reducers, middleware) | ✅ Low |
| **Boilerplate** | ✅ None | ❌ Heavy | ✅ Minimal |
| **Type Safety** | ✅ Full inference | ⚠️ Requires setup | ✅ Good |
| **Selective Re-renders** | ✅ Built-in | ⚠️ Requires selectors | ✅ Built-in |
| **DevTools** | ✅ Built-in DevTools | ✅ Redux DevTools | ✅ DevTools support |
| **Async Support** | ✅ Native (hooks) | ⚠️ Requires middleware | ✅ Native |
| **Context Composition** | ✅ Automatic | ❌ Manual | ⚠️ Manual store combination |

### When to Use React State Custom

✅ **Choose React State Custom if you:**
- Want to use React hooks for state management without learning new patterns
- Need fine-grained control over component re-renders
- Prefer minimal boilerplate and configuration
- Want automatic context lifecycle management
- Need multiple independent state contexts that don't interfere

❌ **Consider Redux if you:**
- Need powerful time-travel debugging (Redux DevTools)
- Have a very large team that benefits from strict architectural patterns
- Already have significant Redux investment

❌ **Consider Zustand if you:**
- Want the absolute smallest bundle size
- Need a simple global store without context isolation
- Don't need automatic context lifecycle management

## 🔥 Real-World Example: User Authentication

```typescript
// authState.ts
function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check authentication on mount
    checkAuth().then(setUser).finally(() => setLoading(false));
  }, []);
  
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const user = await authService.login(email, password);
      setUser(user);
    } finally {
      setLoading(false);
    }
  };
  
  const logout = async () => {
    await authService.logout();
    setUser(null);
  };
  
  return { user, loading, login, logout };
}

export const { useCtxState: useAuthState } = createAutoCtx(
  createRootCtx('auth', useAuthState)
);

// App.tsx
function App() {
  return (
    <>
      <AutoRootCtx />
      <Router>
        <Header />
        <Routes />
      </Router>
    </>
  );
}

// Header.tsx - Only re-renders when user changes
function Header() {
  const ctx = useAuthState();
  const { user, logout } = useQuickSubscribe(ctx);
  
  return (
    <header>
      {user ? (
        <>
          <span>Welcome, {user.name}</span>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <Link to="/login">Login</Link>
      )}
    </header>
  );
}

// ProtectedRoute.tsx - Only re-renders when loading or user changes
function ProtectedRoute({ children }) {
  const ctx = useAuthState();
  const { user, loading } = useDataSubscribeMultiple(ctx, 'user', 'loading');
  
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;
  
  return children;
}
```

**Compare with Redux:**
```typescript
// Redux requires: action types, action creators, reducers, thunks/sagas
// React State Custom: just write a hook! ✨
```

## 📚 Core Concepts

### 1. **Context** - Event-driven state container
```typescript
const ctx = useDataContext<MyState>('my-state');
```

### 2. **Data Source** - Publish values to context
```typescript
useDataSource(ctx, 'count', count);
```

### 3. **Data Subscription** - Subscribe to specific values
```typescript
const count = useDataSubscribe(ctx, 'count');
const { count, name } = useDataSubscribeMultiple(ctx, 'count', 'name');
```

### 4. **Root Context** - Lifecycle-managed context
```typescript
const { Root, useCtxState } = createRootCtx('my-state', useMyState);
```

### 5. **Auto Context** - Automatic instance management
```typescript
const { useCtxState } = createAutoCtx(rootContext);
```

## 🚀 Advanced Features

### Parameterized Contexts
Create multiple instances of the same state with different parameters:

```typescript
function useUserState({ userId }: { userId: string }) {
  // State logic here
}

const { useCtxState: useUserState } = createAutoCtx(
  createRootCtx('user', useUserState)
);

// Different instances for different users
function UserProfile({ userId }) {
  const ctx = useUserState({ userId }); // Automatic instance per userId
  const { user } = useQuickSubscribe(ctx);
  return <div>{user?.name}</div>;
}
```

### Debounced Subscriptions
Optimize performance for frequently changing values:

```typescript
// Re-render at most once per 300ms
const searchQuery = useDataSubscribe(ctx, 'searchQuery', 300);
```

### Transformed Subscriptions
Transform data before using it:

```typescript
const userStats = useDataSubscribeWithTransform(
  ctx,
  'user',
  (user) => ({
    fullName: `${user?.firstName} ${user?.lastName}`,
    isAdmin: user?.role === 'admin'
  })
);
```

## 🔧 Developer Tools

React State Custom includes a built-in DevTools component for debugging and inspecting your application state in real-time.

### Using DevToolContainer

```typescript
import { DevToolContainer } from 'react-state-custom';

function App() {
  return (
    <>
      <AutoRootCtx />
      <DevToolContainer />
      <YourApp />
    </>
  );
}
```

The DevTools panel provides:
- **Real-time State Inspection** - View all context states and their current values
- **Live Updates** - See state changes as they happen with visual indicators
- **Context Browser** - Navigate through different contexts in your app
- **Type-aware Display** - Smart rendering of objects, arrays, strings, and functions

The dev tool is automatically excluded from production builds when using proper bundling (tree-shaking), or you can conditionally render it:

```typescript
function App() {
  return (
    <>
      <AutoRootCtx />
      {process.env.NODE_ENV === 'development' && <DevToolContainer />}
      <YourApp />
    </>
  );
}
```

### Customizing the Toggle Button

```typescript
<DevToolContainer>
  Open Dev Tools
</DevToolContainer>

// Or with custom styling
<DevToolContainer className="my-custom-class">
  🔧 Debug
</DevToolContainer>
```

## 📖 Documentation

For complete API documentation, examples, and advanced patterns, see:
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Complete API reference

## 🎓 Learning Path

1. **Start Simple** - Use `createRootCtx` + `createAutoCtx` for basic state
2. **Add Subscriptions** - Use `useDataSubscribeMultiple` for selective re-renders
3. **Optimize** - Add debouncing and transformations as needed
4. **Scale** - Create parameterized contexts for dynamic instances

## 📦 Installation

```bash
npm install react-state-custom
# or
yarn add react-state-custom
# or
pnpm add react-state-custom
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use in any project.

---

**Made with ❤️ for developers who love React hooks**