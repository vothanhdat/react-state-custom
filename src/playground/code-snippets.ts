// Installation code snippet
export const INSTALLATION_CODE = `# Install via npm
npm install react-state-custom

# Or with yarn
yarn add react-state-custom`

// Basic usage: the golden path
export const BASIC_USAGE_CODE = `import { createStore, AutoRootCtx } from 'react-state-custom';
import { useState } from 'react';

// 1. Write a normal hook. This is your store logic.
const useCounterState = ({ initial = 0 }: { initial?: number }) => {
  const [count, setCount] = useState(initial);
  const increment = () => setCount(c => c + 1);
  return { count, increment };
};

// 2. Turn it into a store. One line.
const { useStore: useCounterStore } = createStore('counter', useCounterState, {
  initialState: { count: 0 }, // what consumers see before the hook runs
});

// 3. Read it anywhere. Re-renders only when \`count\` changes.
function Counter() {
  const { count, increment } = useCounterStore({ initial: 10 });
  return <button onClick={increment}>{count}</button>;
}

// 4. Mount AutoRootCtx once. It runs every store hook for you.
function App() {
  return (
    <>
      <AutoRootCtx />
      <Counter />
    </>
  );
}`

// Parameterized stores: same definition, independent instances
export const PARAMS_CODE = `import { createStore, AutoRootCtx } from 'react-state-custom';
import { useState } from 'react';

type Todo = { id: number; text: string; done: boolean };

// Params must be primitives: they become part of the store's identity.
const useTodoState = ({ listId }: { listId: string }) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const addTodo = (text: string) =>
    setTodos(prev => [...prev, { id: Date.now(), text, done: false }]);
  return { todos, addTodo };
};

const { useStore: useTodoStore } = createStore('todoList', useTodoState, {
  initialState: { todos: [] },
  timeToClean: 5000, // keep a list alive 5s after its last consumer unmounts
});

function TodoList({ listId }: { listId: string }) {
  const { todos, addTodo } = useTodoStore({ listId });
  return (
    <div>
      <h2>List {listId}</h2>
      {todos.map(todo => <div key={todo.id}>{todo.text}</div>)}
      <button onClick={() => addTodo('New task')}>Add</button>
    </div>
  );
}

// Different params = different store instances. Same params = shared instance.
function App() {
  return (
    <>
      <AutoRootCtx />
      <TodoList listId="personal" />
      <TodoList listId="work" />
    </>
  );
}`

// Composing stores: a store hook can read other stores
export const COMPOSE_CODE = `import { createStore } from 'react-state-custom';
import { useState } from 'react';

const useSettingsState = () => {
  const [taxRate, setTaxRate] = useState(0.1);
  return { taxRate, setTaxRate };
};
export const { useStore: useSettingsStore } = createStore('settings', useSettingsState, {
  initialState: { taxRate: 0.1 },
});

// A store is just a hook, so it can call another store's hook.
// Every invoice re-renders when taxRate changes, nothing else does.
const useInvoiceState = ({ invoiceId }: { invoiceId: string }) => {
  const { taxRate } = useSettingsStore();
  const [subtotal, setSubtotal] = useState(100);
  return { subtotal, setSubtotal, total: subtotal * (1 + taxRate) };
};
export const { useStore: useInvoiceStore } = createStore('invoice', useInvoiceState, {
  initialState: { subtotal: 0, total: 0 },
});`

// Selectors, Suspense and access from outside React
export const ADVANCED_CODE = `import { Suspense } from 'react';
import { useUserStore, useUserStoreSuspense, getUserStore } from './userStore';

// Selector: re-render only when the selected (deep or derived) value changes
function UserName({ userId }: { userId: string }) {
  const name = useUserStore({ userId }, s => s.user?.name);
  return <span>{name}</span>;
}

// Suspense: wait until the store is ready, then everything is typed as present
function Profile({ userId }: { userId: string }) {
  const { user } = useUserStoreSuspense({ userId }, s => !s.isLoading);
  return <h1>{user.name}</h1>;
}
const page = (
  <Suspense fallback={<p>Loading…</p>}>
    <Profile userId="42" />
  </Suspense>
);

// Outside React: sockets, routers, tests, or a handler that needs the latest value
const user = getUserStore({ userId: '42' });
user.get().user;                                  // plain snapshot, safe anywhere
user.get().reload?.();                            // actions are part of the state
const stop = user.subscribe((state, key) => console.log(key, state));
const release = user.retain();                    // keep it running with no component reading it`

// With DevTools
export const DEVTOOLS_CODE = `import { AutoRootCtx } from 'react-state-custom';
import { DevToolContainer } from 'react-state-custom/dev-tool';
import 'react-state-custom/style.css';

function App() {
  return (
    <>
      <AutoRootCtx />
      <DevToolContainer style={{ right: '20px', bottom: '20px' }} />
      <YourApp />
    </>
  );
}`

// Error handling
export const ERROR_WRAPPER_CODE = `import { AutoRootCtx } from 'react-state-custom';
import { ErrorBoundary } from 'react-error-boundary';

// By default AutoRootCtx wraps each store in StoreErrorBoundary:
// a store hook that throws is disabled and logged, other stores keep running.
// Pass your own Wrapper to render something or report the error.
const StoreWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallbackRender={({ error, resetErrorBoundary }) => (
      <div role="alert" style={{ padding: '2em' }}>
        <h2>A store crashed:</h2>
        <pre style={{ color: 'red' }}>{error.message}</pre>
        <button onClick={resetErrorBoundary}>Try again</button>
      </div>
    )}
    onError={error => reportToSentry(error)}
  >
    {children}
  </ErrorBoundary>
);

function App() {
  return (
    <>
      <AutoRootCtx Wrapper={StoreWrapper} />
      <YourApp />
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
  { id: 'params', label: 'Parameterized Stores', code: PARAMS_CODE },
  { id: 'compose', label: 'Composing Stores', code: COMPOSE_CODE },
  { id: 'advanced', label: 'Selectors & Suspense', code: ADVANCED_CODE },
  { id: 'devtools', label: 'DevTools', code: DEVTOOLS_CODE },
  { id: 'error', label: 'Error Handling', code: ERROR_WRAPPER_CODE },
]
