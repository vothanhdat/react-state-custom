# Developer tools

Imported from the separate entry so the UI and its CSS never reach production bundles.

```ts
import { DevToolContainer, DevToolState, StateView, DataViewDefault } from 'react-state-custom/dev-tool'
import type { DataViewComponent } from 'react-state-custom/dev-tool'
import 'react-state-custom/style.css'
```

## `DevToolContainer`

A floating inspector that lists all active stores and their state in real time.

```ts
function DevToolContainer(props: {
  Component?: DataViewComponent
  children?: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element
```

| prop | description |
|---|---|
| `Component` | Custom renderer for a store's value, receives `{ name, value }`. Defaults to `DataViewDefault`, a JSON tree. |
| `children` | Content of the trigger button. Defaults to `"Toggle Dev Tool"`. |
| other props | Forwarded to the trigger button, which is `position: fixed`. Use `style` or `className` to place it. |

```tsx
<DevToolContainer style={{ right: 20, bottom: 20 }} />
```

## `DevToolState`

The panel without the toggle button, for embedding in your own debug UI. `Component` is required here: `<DevToolState Component={DataViewDefault} />`.

## `StateView`

Renders one store by context name: `<StateView dataKey="counter?initial=10" Component={DataViewDefault} />`. Reads from the context cache and never creates a store.

## `DataViewComponent`

```ts
type DataViewComponent = React.FC<{ name: string; value: any }>
```

`DataViewDefault` is the built-in implementation.

See the [Developer tools guide](/guide/devtools).
