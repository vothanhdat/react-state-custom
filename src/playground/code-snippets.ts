// Installation code snippet
export const INSTALLATION_CODE = `# Install via npm
npm install react-state-custom

# Or with yarn
yarn add react-state-custom`

// Basic usage code snippet
export const BASIC_USAGE_CODE = `import { createRootCtx } from 'react-state-custom';
import { useState } from 'react';

// Create a root context with your custom hook
const useCounterCtx = createRootCtx('counter', () => {
  const [count, setCount] = useState(0);
  return { count, setCount };
});

// Use the context in your components
function Counter() {
  const { count, setCount } = useCounterCtx.useCtxState();
  return (
    <div>
      <h1>{count}</h1>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}

// Mount the Root component in your app
function App() {
  return (
    <>
      <useCounterCtx.Root />
      <Counter />
    </>
  );
}`

// With DevTools and Error Boundary
export const DEVTOOLS_CODE = `import { createAutoCtx, AutoRootCtx, DevToolContainer } from 'react-state-custom';
import { ErrorBoundary } from 'react-error-boundary';
import 'react-state-custom/dist/react-state-custom.css';
import { useState } from 'react';

const useAppState = createAutoCtx(
  createRootCtx('app', () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    return { user, setUser, loading, setLoading };
  })
);

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AutoRootCtx />
      <DevToolContainer 
        style={{ right: '20px', bottom: '20px' }}
      />
      <YourApp />
    </ErrorBoundary>
  );
}`

// Best practices with scoped contexts
export const BEST_PRACTICES_CODE = `import { createAutoCtx, AutoRootCtx, useQuickSubscribe } from 'react-state-custom';
import { useState, useCallback } from 'react';

// ✅ Create scoped contexts with parameters
const useTodoList = createAutoCtx(
  createRootCtx('todoList', (listId: string) => {
    const [todos, setTodos] = useState<Todo[]>([]);
    
    const addTodo = useCallback((text: string) => {
      setTodos(prev => [...prev, { id: Date.now(), text, done: false }]);
    }, []);
    
    const toggleTodo = useCallback((id: number) => {
      setTodos(prev => prev.map(t => 
        t.id === id ? { ...t, done: !t.done } : t
      ));
    }, []);
    
    return { todos, addTodo, toggleTodo };
  })
);

// ✅ Use params to create separate instances
function TodoList({ listId }: { listId: string }) {
  const ctx = useTodoList.useCtxState({ listId });
  const { todos, addTodo } = useQuickSubscribe(ctx);
  
  return (
    <div>
      <h2>List {listId}</h2>
      {todos.map(todo => (
        <div key={todo.id}>{todo.text}</div>
      ))}
      <button onClick={() => addTodo('New task')}>Add</button>
    </div>
  );
}

// ✅ Different params = different state instances
function App() {
  return (
    <>
      <AutoRootCtx />
      <TodoList listId="personal" />
      <TodoList listId="work" />
    </>
  );
}`

export type CodeExample = {
  id: string
  label: string
  code: string
}

export const CODE_EXAMPLES: CodeExample[] = [
  { id: 'basic', label: 'Basic Usage', code: BASIC_USAGE_CODE },
  { id: 'devtools', label: 'With DevTools', code: DEVTOOLS_CODE },
  { id: 'best', label: 'Best Practices', code: BEST_PRACTICES_CODE },
]
