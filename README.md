# React State Custom - Documentation

Welcome to the comprehensive documentation for the `react-state-custom` library!

## 📚 Documentation Files

- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Complete API reference with examples for all exported functions, hooks, and classes

## 🚀 Quick Start

```bash
npm install react-state-custom
```

## 📖 What's Inside

The `react-state-custom` library provides a powerful set of tools for managing shared state in React applications:

### Core Features

- **Context System** - Type-safe context management with event-driven subscriptions
- **Root Context Factory** - Automated context lifecycle management
- **Auto Context System** - Self-managing context instances
- **Utility Hooks** - Performance optimization tools

### Key Benefits

- ✅ **Type Safety** - Full TypeScript support with strong typing
- ✅ **Performance** - Only re-renders when subscribed data changes
- ✅ **Flexibility** - Works with any data structure
- ✅ **Developer Experience** - Rich debugging and error checking
- ✅ **Minimal Boilerplate** - Automated context management

## 📝 Documentation Structure

The [API Documentation](./API_DOCUMENTATION.md) is organized into the following sections:

1. **Core Context System** - Basic context functionality
2. **Data Source Hooks** - Publishing data to contexts
3. **Data Subscription Hooks** - Subscribing to context changes
4. **Root Context Factory** - Advanced context patterns
5. **Auto Context System** - Automated context management
6. **Utility Hooks** - Performance and utility functions
7. **Usage Patterns** - Common implementation patterns
8. **Examples** - Complete application examples

## 🎯 Common Use Cases

- **Global State Management** - Application-wide state without Redux complexity
- **Component Communication** - Share data between distant components
- **Performance Optimization** - Minimize unnecessary re-renders
- **Context Composition** - Combine multiple contexts efficiently

## 🔧 Quick Example

### Using createRootCtx for Advanced State Management


file main.tsx
```typescript
import { AutoRootCtx } from 'react-state-custom';

// Root Component
function App({children}) {
  return (
    <>
      <AutoRootCtx />
      {children}
    </>
  );
}

```
file userState.ts
```typescript
import { createRootCtx, createAutoCtx,  } from 'react-state-custom';

interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

// Create a state hook
function useUserState(props: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchUser(props.userId).then(setUser).catch(setError).finally(() => setLoading(false));
  }, [props.userId]);
  
  return { user, loading, error };
}

// Register State hook
const { useCtxState: useUserCtxState } = createAutoCtx(createRootCtx(
  'user-state',
  useUserState
));

export { useUserCtxState }

```

file UserProfile.tsx
```typescript
import { useDataSubscribeMultiple, useQuickSubscribe } from 'react-state-custom';
import { useUserCtxState } from "./userState.ts"

// Consumer component using useDataSubscribeMultiple
function UserProfile({ userId }: { userId: string }) {
  const ctx = useUserCtxState({ userId });
  const { user, loading, error } = useDataSubscribeMultiple(ctx, 'user', 'loading', 'error');
  
  if (loading) return <div>Loading user...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>Welcome, {user?.name}!</div>;
}

// Or using useQuickSubscribe  for Simplified Access

function UserProfileV2({ userId }: { userId: string }) {
  const ctx = useUserCtxState({ userId });
  const { user, loading, error } = useQuickSubscribe(ctx);
  
  if (loading) return <div>Loading user...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>Welcome, {user?.name}!</div>;
}
```

## 📄 License

MIT License - see the main repository for details.

---

For the complete API reference with detailed examples, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).