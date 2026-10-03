# Developer tools

Imported from the separate entry so the UI and its CSS never reach production bundles.

```ts
import { DevToolContainer, DevToolState, StateView, DataViewDefault } from 'react-state-custom/dev-tool'
import type { DevToolContainerProps, DataViewComponent } from 'react-state-custom/dev-tool'
import 'react-state-custom/style.css'

import { ObjectDataView } from 'react-state-custom/dev-tool/obj-view'   // needs react-obj-view
```

## `DevToolContainer`

A floating inspector: a fixed trigger button and, while open, a resizable panel docked to the bottom of the viewport listing all live stores and their state in real time.

```ts
function DevToolContainer(props: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> & {
  Component?: DataViewComponent
  defaultOpen?: boolean
  defaultHeight?: number
}): JSX.Element
```

| prop | description |
|---|---|
| `Component` | Renders a store's value, receives `{ name, value }`. Defaults to `DataViewDefault`, a JSON text view. |
| `defaultOpen` | Open the panel on first mount. Default `false`. The open state is then remembered per tab (`sessionStorage`). |
| `defaultHeight` | Panel height in pixels on first open. Default: a third of the viewport. Remembered after a resize. |
| `children` | Content of the trigger button. Defaults to `"Toggle Dev Tool"`. |
| other props | Forwarded to the trigger button, which is `position: fixed` and hidden while the panel is open. Use `style` or `className` to place it. |

```tsx
<DevToolContainer defaultOpen style={{ right: 20, bottom: 20 }} />
```

## `DevToolState`

The panel without the trigger button, for embedding in your own debug UI: `<DevToolState Component={MyRenderer} />`. `Component` defaults to `DataViewDefault`.

## `StateView`

Renders one store by full context name, with a header showing its params, scope and whether it is still mounted: `<StateView dataKey="counter?initial=10" />`. Reads from the context cache and never creates a store; pass `Component` to change the renderer and `onClose` to get a close button.

## `DataViewComponent`

```ts
type DataViewComponent = React.FC<{ name: string; value: any }>
```

`name` is the full context name (`"<scopeId>/<store>?<params>"`), `value` the store's current data.

- `DataViewDefault` prints `value` with [`formatState`](/api/primitives#formatstate): JSON text that keeps functions, `undefined`, `bigint`, `Map`/`Set` entries and marks circular references.
- `ObjectDataView` (entry `react-state-custom/dev-tool/obj-view`) renders an expandable tree with [react-obj-view](https://github.com/vothanhdat/react-obj-view), an optional peer dependency. Import `react-obj-view/dist/react-obj-view.css` next to it.

See the [Developer tools guide](/guide/devtools).
