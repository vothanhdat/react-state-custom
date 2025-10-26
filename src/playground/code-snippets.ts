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

// With DevTools
export const DEVTOOLS_CODE = `import { AutoRootCtx, DevToolContainer } from 'react-state-custom';
import 'react-state-custom/dist/react-state-custom.css';

function App() {
  return (
    <>
      <AutoRootCtx />
      <DevToolContainer 
        style={{ right: '20px', bottom: '20px' }}
      />
      <YourApp />
    </>
  );
}`

// With Error Boundary Wrapper
export const ERROR_WRAPPER_CODE = `import { AutoRootCtx } from 'react-state-custom';
import { ErrorBoundary } from 'react-error-boundary';
import 'react-state-custom/dist/react-state-custom.css';

// Create a reusable error wrapper component
const ErrorWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const fallbackRender = ({ error, resetErrorBoundary }) => (
    <div role="alert" style={{ padding: '2em' }}>
      <h2>Something went wrong:</h2>
      <pre style={{ color: 'red' }}>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );

  return (
    <ErrorBoundary fallbackRender={fallbackRender} onReset={() => {}}>
      {children}
    </ErrorBoundary>
  );
};

// Pass ErrorWrapper to AutoRootCtx to wrap all root contexts
function App() {
  return (
    <>
      <AutoRootCtx Wrapper={ErrorWrapper} />
      <YourApp />
    </>
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
  { id: 'devtools', label: 'DevTools', code: DEVTOOLS_CODE },
  { id: 'error', label: 'Error Boundary', code: ERROR_WRAPPER_CODE },
  { id: 'best', label: 'Best Practices', code: BEST_PRACTICES_CODE },
]
