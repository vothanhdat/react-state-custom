# Developer tools

Inspect every mounted store and its live values with the built-in dev tool. It lives in a separate entry, so nothing reaches your production bundle unless you import it.

```tsx
import { DevToolContainer } from 'react-state-custom/dev-tool'
import 'react-state-custom/style.css'

function App() {
  return (
    <>
      <AutoRootCtx />
      <YourAppContent />
      {import.meta.env.DEV && <DevToolContainer />}
    </>
  )
}
```

`DevToolContainer` renders a fixed trigger button. Clicking it opens a panel listing each store instance by name and params, with its current data as a JSON tree that updates in real time.

## Placing the button

Any prop other than `Component` and `children` is forwarded to the trigger button, which is `position: fixed`. Use `style` or `className` to place it, and `children` to change its label.

```tsx
<DevToolContainer style={{ right: 20, bottom: 20 }}>State</DevToolContainer>
```

## Custom value renderer

Pass `Component` to render values your own way. It receives `{ name, value }` for each store.

```tsx
<DevToolContainer Component={({ name, value }) => <pre>{name}: {JSON.stringify(value)}</pre>} />
```

## Embedding the panel

`DevToolState` is the panel without the toggle button, for embedding in your own debug UI. `StateView` renders one store. Both come from the same entry; see the [dev tools API](/api/dev-tools).

## Debugging without the UI

`AutoRootCtx` and `StateScopeProvider` accept `debugging`. When `true`, they render a raw text view of the mounted stores in the DOM, useful in tests and when the dev-tool bundle is not wanted.
