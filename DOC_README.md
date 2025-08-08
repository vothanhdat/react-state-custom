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

## 📄 License

MIT License - see the main repository for details.

---

For the complete API reference with detailed examples, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).