# React State Custom

**The "It's Just a Hook" State Manager for React.**

Turn any React hook into a global store. Zero boilerplate. Full type safety. Automatic lifecycle management.

[![Demo](https://img.shields.io/badge/Demo-Live-blue?style=flat-square)](https://vothanhdat.github.io/react-state-custom/)
[![npm version](https://img.shields.io/npm/v/react-state-custom?style=flat-square)](https://www.npmjs.com/package/react-state-custom)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

```bash
npm install react-state-custom
```

🎮 **[Try the Live Demo →](https://vothanhdat.github.io/react-state-custom/)**

---

## ⚡ The 30-Second Pitch

Stop writing reducers, actions, and manual providers. If you can write a React hook, you've already written your store.

```tsx
// 1. Write a standard hook (your store logic)
const useCountState = ({ initial = 0 }) => {
  const [count, setCount] = useState(initial)
  const increment = () => setCount(c => c + 1)
  return { count, increment }
}

// 2. Create a store
export const { useStore } = createStore('counter', useCountState)

// 3. Use it anywhere
function Counter() {
  const { count, increment } = useStore({ initial: 10 })
  return <button onClick={increment}>{count}</button>
}
```

**That's it.** No `Provider` wrapping. No complex setup. Just hooks.

---

## 🚀 Why React State Custom?

Most state libraries force you to learn a new way to write logic (reducers, atoms, proxies). **React State Custom** lets you use the React skills you already have.

### 💎 Zero Boilerplate
Define state with `useState`, `useEffect`, `useMemo`. No new syntax to learn.

### 🎯 Selective Re-renders
Components only re-render when the specific data they use changes. Performance is built-in.

### 🔄 Automatic Lifecycle
Stores are created when needed and destroyed when unused. No more manual cleanup or memory leaks.

### 🛡️ TypeScript First
Full type inference out of the box. Your IDE knows exactly what's in your store.

---

## 🛠️ Quick Start

### 1. Define Your State
Write a hook that returns the data and actions you want to share.

```typescript
// features/userState.ts
import { useState, useEffect } from 'react'

export const useUserState = ({ userId }: { userId: string }) => {
  const [user, setUser] = useState(null)
  
  useEffect(() => {
    fetchUser(userId).then(setUser)
  }, [userId])

  return { user, isLoading: !user }
}
```

### 2. Create the Store
Use `createStore` to generate a hook for your components.

```typescript
import { createStore } from 'react-state-custom'
import { useUserState } from './features/userState'

export const { useStore: useUserStore } = createStore('user', useUserState)
```

### 3. Mount the Root (Once)
Add `<AutoRootCtx />` to your app's root. This component manages all your stores automatically.

```tsx
// App.tsx
import { AutoRootCtx } from 'react-state-custom'

export default function App() {
  return (
    <>
      <AutoRootCtx />
      <YourAppContent />
    </>
  )
}
```

---

## 🆚 Comparison

| Feature | React State Custom | Redux | Context API | Zustand |
|:---|:---:|:---:|:---:|:---:|
| **Paradigm** | Just Hooks 🪝 | Actions/Reducers | Providers | Store Object |
| **Boilerplate** | 🟢 None | 🔴 High | 🟡 Medium | 🟢 Low |
| **Auto Lifecycle** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Selective Renders** | ✅ Automatic | ⚠️ Selectors | ❌ Manual | ✅ Selectors |
| **Learning Curve** | 🟢 Low | 🔴 High | 🟡 Medium | 🟢 Low |

---

## 🧩 Advanced Features

### 🔌 Developer Tools
Inspect your state in real-time with the built-in DevTools.

```tsx
import { DevToolContainer } from 'react-state-custom'
import 'react-state-custom/dist/react-state-custom.css'

<DevToolContainer />
```

### 🆔 Parameterized Stores
Create multiple independent instances of the same store by passing different parameters.

```tsx
// Creates a unique store for each ID
const { count } = useStore({ id: 'counter-1' })
const { count } = useStore({ id: 'counter-2' })
```

### ⚡️ Derived State
Compose stores just like hooks.

```tsx
const useCartTotal = () => {
  const { items } = useCartStore({})
  return items.reduce((total, item) => total + item.price, 0)
}
```

---

## 📦 Installation

```bash
npm install react-state-custom
# or
yarn add react-state-custom
```

## 📖 Documentation

- **[API Reference](./API_DOCUMENTATION.md)** - Full API documentation.
- **[Live Demo](https://vothanhdat.github.io/react-state-custom/)** - Interactive examples.

## 📄 License

MIT © Vo Thanh Dat
