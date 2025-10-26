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
