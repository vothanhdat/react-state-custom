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
const { useStore: useCounterStore } = createStore('counter', useCounterState);

// 3. Read it anywhere. Re-renders only when \`count\` changes.
//    Every key is undefined until the store has run once: default at the read.
function Counter() {
  const { count, increment } = useCounterStore({ initial: 10 });
  return <button onClick={increment}>{count ?? 0}</button>;
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
  timeToClean: 5000, // keep a list alive 5s after its last consumer unmounts
});

function TodoList({ listId }: { listId: string }) {
  const { todos, addTodo } = useTodoStore({ listId });
  return (
    <div>
      <h2>List {listId}</h2>
      {todos?.map(todo => <div key={todo.id}>{todo.text}</div>)}
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
export const { useStore: useSettingsStore } = createStore('settings', useSettingsState);

// A store is just a hook, so it can call another store's hook.
// Every invoice re-renders when taxRate changes, nothing else does.
const useInvoiceState = ({ invoiceId }: { invoiceId: string }) => {
  const { taxRate = 0 } = useSettingsStore(); // undefined until settings has run once
  const [subtotal, setSubtotal] = useState(100);
  return { subtotal, setSubtotal, total: subtotal * (1 + taxRate) };
};
export const { useStore: useInvoiceStore } = createStore('invoice', useInvoiceState);`

// Selectors, many instances and access from outside React
export const ADVANCED_CODE = `import { useMultipleStore } from 'react-state-custom';
import { useUserStore, userRef } from './userStore';

// Selector: re-render only when the selected (deep or derived) value changes
function UserName({ userId }: { userId: string }) {
  const name = useUserStore({ userId }, { select: s => s.user?.name });
  return <span>{name ?? '…'}</span>;
}

// Many instances in one call, for a list of any length
function Team({ ids }: { ids: string[] }) {
  const users = useMultipleStore(ids.map(userId => userRef({ userId })));
  return <ul>{users.map((u, i) => <li key={ids[i]}>{u.user?.name ?? '…'}</li>)}</ul>;
}

// Outside React: sockets, routers, tests, or a handler that needs the latest value
const user = userRef({ userId: '42' });
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
export const ERROR_CODE = `import { createRoot } from 'react-dom/client';

// Each store runs inside its own error boundary: a store hook that throws is
// disabled and logged, and every other store keeps running.
// React 19 hands every error a boundary caught to the root's onCaughtError.
createRoot(document.getElementById('root')!, {
  onCaughtError: (error, info) => reportToSentry(error, info.componentStack),
}).render(<App />);`

export type CodeExample = {
  id: string
  label: string
  code: string
}

export const CODE_EXAMPLES: CodeExample[] = [
  { id: 'basic', label: 'Basic Usage', code: BASIC_USAGE_CODE },
  { id: 'params', label: 'Parameterized Stores', code: PARAMS_CODE },
  { id: 'compose', label: 'Composing Stores', code: COMPOSE_CODE },
  { id: 'advanced', label: 'Selectors & Many Instances', code: ADVANCED_CODE },
  { id: 'devtools', label: 'DevTools', code: DEVTOOLS_CODE },
  { id: 'error', label: 'Error Handling', code: ERROR_CODE },
]
