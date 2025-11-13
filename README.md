# React State Custom

**Simple. Powerful. TypeScript-first.**

A lightweight React state management library that combines the simplicity of React hooks with the power of event-driven subscriptions. No boilerplate, no complexity—just pure, performant state management.

[![Demo](https://img.shields.io/badge/Demo-Live-blue?style=flat-square)](https://vothanhdat.github.io/react-state-custom/)
[![npm version](https://img.shields.io/npm/v/react-state-custom?style=flat-square)](https://www.npmjs.com/package/react-state-custom)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

```bash
npm install react-state-custom
```

🎮 **[Try the Live Demo →](https://vothanhdat.github.io/react-state-custom/)**

## Why React State Custom?

**Zero Boilerplate** • **Type-Safe** • **Selective Re-renders** • **Hook-Based** • **~10KB Bundle**

React State Custom lets you write state management code that feels natural—because it **is** just React hooks. Use the same hooks you already know (`useState`, `useEffect`, etc.) to create powerful, shared state without learning new paradigms.

### When `useState` + `useEffect` Fall Short

Even though React hooks are flexible, they start to hurt once state crosses component boundaries:

- **Prop drilling & manual providers** – every time state needs to be shared, you create a context, memoize values, and remember to wrap trees.
- **Coarse-grained re-renders** – updating one property forces every subscriber of that context to render, even if they don't consume the changed field.
- **Lifecycle bookkeeping** – you manually manage instance lifetimes, clean up effects, and guard against components mounting before providers.
- **Zero visibility** – there's no built-in way to inspect shared state, throttle noisy updates, or keep debugging breadcrumbs.

React State Custom keeps your favorite hooks but layers on automatic context lifecycles, selective subscriptions, and built-in tooling so you can stay productive as your app grows.

## ⚡ Quick Example

### Without React State Custom (manual context plumbing)

```typescript
const CounterContext = createContext<{
  count: number;
  increment: () => void;
  decrement: () => void;
} | null>(null);

function CounterProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const value = useMemo(
    () => ({
      count,
      increment: () => setCount(c => c + 1),
      decrement: () => setCount(c => c - 1),
    }),
    [count]
  );

  return <CounterContext.Provider value={value}>{children}</CounterContext.Provider>;
}

function useCounter() {
  const ctx = useContext(CounterContext);
  if (!ctx) throw new Error('CounterProvider missing');
  return ctx;
}
```

Every consumer re-renders whenever anything in `value` changes, you have to remember to wrap parts of the tree with `CounterProvider`, and tearing this pattern down for parameterized instances gets messy fast.

### With React State Custom (hook-first store)

```typescript
import { createRootCtx, createAutoCtx, useQuickSubscribe, AutoRootCtx } from 'react-state-custom';

// 1. Write your state logic using familiar React hooks
function useCounterState() {
  const [count, setCount] = useState(0);
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  
  return { count, increment, decrement };
}

// 2. Create shared context (one line!)
const { useCtxState } = createAutoCtx(createRootCtx('counter', useCounterState));

// 3. Add AutoRootCtx to your app root (mount it once near the top of your tree)
function App() {
  return (
    <>
      <AutoRootCtx />
      <Counter />
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

> ℹ️ `AutoRootCtx` accepts optional `Wrapper` and `debugging` props. Pass an ErrorBoundary-like component through `Wrapper` to isolate failures, or set `debugging` to `true` to render raw state snapshots in the DOM (handy alongside React DevTools when tracking updates).

`useQuickSubscribe` keeps `Counter` focused on `count`, so even if this context grows with more fields later, the component only re-renders when `count` changes.

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
With `AutoRootCtx`, state contexts are automatically created and destroyed as needed. Mount it once near your application root, optionally providing a `Wrapper` (for error boundaries) or enabling `debugging` to render live state snapshots in the DOM—useful context when pairing with React DevTools. No manual provider management required.

### 4. **TypeScript First**
Full type inference and type safety throughout. Your IDE knows exactly what's in your state.

### 5. **Tiny Bundle Size**
~10KB gzipped. No dependencies except React.

## 🆚 Comparison with Hooks, Redux & Zustand

| Feature | React State Custom | Plain Hooks (Context) | Redux | Zustand |
|---------|-------------------|-----------------------|-------|---------|
| **Bundle Size** | ~10KB | 0KB (just React) | ~50KB (with toolkit) | ~1KB |
| **Learning Curve** | ✅ Minimal (just hooks) | ⚠️ Familiar APIs, but patterns are DIY | ❌ High (actions, reducers, middleware) | ✅ Low |
| **Boilerplate** | ✅ None | ❌ Manual providers + prop drilling | ❌ Heavy | ✅ Minimal |
| **Type Safety** | ✅ Full inference | ⚠️ Custom per-context typing | ⚠️ Requires setup | ✅ Good |
| **Selective Re-renders** | ✅ Built-in | ❌ Context update = every consumer renders | ⚠️ Requires selectors | ✅ Built-in |
| **DevTools** | ✅ Built-in UI | ❌ None | ✅ Redux DevTools | ✅ DevTools support |
| **Async Support** | ✅ Native (hooks) | ✅ Native (hooks) | ⚠️ Requires middleware | ✅ Native |
| **Context Composition** | ✅ Automatic | ❌ Manual provider trees | ❌ Manual | ⚠️ Manual store combination |

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

### Developer Tools
Visual debugging component to inspect all your context data in real-time:

```typescript
import { DevToolContainer } from 'react-state-custom';
import 'react-state-custom/dist/react-state-custom.css';

function App() {
  return (
    <>
      <AutoRootCtx />
      <YourAppContent />
      <DevToolContainer />
    </>
  );
}
```

The toggle reveals a bottom-docked inspector that now uses resizable split panes powered by `@uiw/react-split`. Drag the gutter to adjust how much space the context list or detail view occupies while keeping your application visible above.

**Custom data viewer with rich object visualization:**
```typescript
import { DataViewComponent } from 'react-state-custom';
import { ObjectView } from 'react-obj-view';
import 'react-obj-view/dist/react-obj-view.css'; // Required for ObjectView styling

const CustomDataView: DataViewComponent = ({ name, value }) => {
  return <ObjectView name={name} value={value} expandLevel={2} />;
};

<DevToolContainer Component={CustomDataView} />
```

### Parameterized Contexts
Create multiple instances of the same state with different parameters:

```typescript
function useUserState({ userId }: { userId: string }) {
  // State logic here
}

const { useCtxState: useUserCtxState } = createAutoCtx(
  createRootCtx('user', useUserState)
);

// Different instances for different users
function UserProfile({ userId }) {
  const ctx = useUserCtxState({ userId }); // Automatic instance per userId
  const { user } = useQuickSubscribe(ctx);
  return <div>{user?.name}</div>;
}
```

> Need to avoid rapid mount/unmount churn? Pass a second argument to `createAutoCtx` (for example `createAutoCtx(rootCtx, 200)`) to keep instances alive for a few extra milliseconds before disposal.

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

## 🎮 Live Examples

Explore interactive examples in the **[Live Demo](https://vothanhdat.github.io/react-state-custom/)**:

- **Counter** - Basic state management with increment, decrement, and reset
- **Todo List** - Multiple independent lists with scoped contexts
- **Form Validation** - Real-time validation with error handling
- **Timer** - Side effects and cleanup with millisecond precision
- **Shopping Cart** - Complex state with derived values (total, itemCount)

Each example includes live code editing with syntax highlighting, powered by Sandpack!

## 📖 Documentation

For complete API documentation, examples, and advanced patterns, see:
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Complete API reference
- **[Live Demo](https://vothanhdat.github.io/react-state-custom/)** - Interactive examples

## 🛠️ Development

```bash
# Install dependencies
yarn install

# Run development UI with example selector
yarn dev

# Run interactive playground with live code editing
yarn dev:playground

# Build library
yarn build

# Build demo site
yarn build:demo

# Preview demo locally
yarn preview
```

### Development Modes

**`yarn dev`** - Starts a clean development UI with an interactive example selector. Great for:
- Testing all examples in one place
- Quick switching between different examples
- Visual debugging with DevTool component

**`yarn dev:playground`** - Starts the Sandpack-powered playground with live code editing. Perfect for:
- Creating interactive demos
- Live code editing and experimentation
- Sharing editable examples

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
