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

```typescript
import { useDataContext, useDataSource, useDataSubscribe } from 'react-state-custom';

interface AppState {
  user: User | null;
  theme: 'light' | 'dark';
}

// Provider component
function AppProvider({ children }) {
  const ctx = useDataContext<AppState>('app-state');
  const user = useCurrentUser();
  const theme = useTheme();
  
  useDataSource(ctx, 'user', user);
  useDataSource(ctx, 'theme', theme);
  
  return <>{children}</>;
}

// Consumer component
function UserProfile() {
  const ctx = useDataContext<AppState>('app-state');
  const user = useDataSubscribe(ctx, 'user');
  
  return <div>Hello, {user?.name}</div>;
}
```

## 🔧 Additional Examples

### Using createRootCtx for Advanced State Management

```typescript
import { createRootCtx, useDataSubscribeMultiple } from 'react-state-custom';

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

// Create root context factory
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

// Consumer component using useDataSubscribeMultiple
function UserProfile({ userId }: { userId: string }) {
  const ctx = useUserCtxState({ userId });
  const { user, loading, error } = useDataSubscribeMultiple(ctx, 'user', 'loading', 'error');
  
  if (loading) return <div>Loading user...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>Welcome, {user?.name}!</div>;
}
```

### Using useQuickSubscribe for Simplified Access

```typescript
import { useDataContext, useQuickSubscribe } from 'react-state-custom';

interface SettingsState {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
  updateSetting: (key: string, value: any) => void;
}

// Component using useQuickSubscribe for easy property access
function SettingsPanel() {
  const ctx = useDataContext<SettingsState>('settings');
  
  // useQuickSubscribe automatically subscribes to accessed properties
  const { theme, language, notifications, updateSetting } = useQuickSubscribe(ctx);
  
  return (
    <div className={`settings-panel ${theme}`}>
      <h2>Settings</h2>
      
      <label>
        Theme:
        <select value={theme} onChange={(e) => updateSetting('theme', e.target.value)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      
      <label>
        Language:
        <input 
          value={language} 
          onChange={(e) => updateSetting('language', e.target.value)} 
        />
      </label>
      
      <label>
        <input 
          type="checkbox" 
          checked={notifications} 
          onChange={(e) => updateSetting('notifications', e.target.checked)} 
        />
        Enable notifications
      </label>
    </div>
  );
}
```

## 📄 License

MIT License - see the main repository for details.

---

For the complete API reference with detailed examples, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).