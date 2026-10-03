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

`DevToolContainer` renders a fixed trigger button. Clicking it opens a panel docked to the bottom of the viewport:

- the left list shows every live store instance, grouped by store name, with its params and how many keys it holds; an instance flashes whenever its data changes, and stores inside a `StateScopeProvider` show their scope next to the name;
- the filter box narrows the list (several words match all of them);
- click an instance to open it on the right, up to five side by side; an instance whose store unmounts keeps its last data with an `unmounted` badge, and follows the new instance if the store mounts again;
- drag the title bar to resize the panel, and the edge of the list to resize it; the open state and sizes are remembered per tab.

The panel is read-only: it never creates a store, so inspecting an evicted instance does not bring it back.

## React DevTools

Each running store shows up under `AutoRootCtx` in the React DevTools component tree, named after the store, so the search box finds it:

```
AutoRootCtx
└ Bucket
  └ StoreInstance key="todos?listId=work"
    └ StoreErrorBoundary › StoreFailure
      └ Store(todos)        ← your hook runs here; its hooks show in the inspector
```

The key of `StoreInstance` is the instance's name and params. Instances are spread over 64 `Bucket` components so that starting or stopping one re-renders only its bucket. `StoreErrorBoundary` is the default `Wrapper`, replaced by yours when you pass one.

## Placing the button

Any prop other than `Component`, `defaultOpen` and `defaultHeight` is forwarded to the trigger button, which is `position: fixed`. Use `style` or `className` to place it, and `children` to change its label. The button is hidden while the panel is open; the panel has its own close button.

```tsx
<DevToolContainer defaultOpen style={{ left: 20, bottom: 20, right: 'auto' }}>State</DevToolContainer>
```

The overlay sits at `z-index: 9999`; set `--rs-z-index` on `:root` to change it. The colors follow the system theme (`--rs-color`, `--rs-bg-color` and friends are overridable the same way).

## Value renderers

The default renderer prints each store's value as JSON text, keeping what plain `JSON.stringify` drops: functions show as `ƒ increment()`, `undefined`, `bigint` and symbols as text, `Map` and `Set` as their entries, and circular references as `[Circular]`.

For an expandable tree, use the renderer built on [react-obj-view](https://github.com/vothanhdat/react-obj-view). It lives in its own entry because it needs that package as an optional peer dependency:

```bash
npm install -D react-obj-view
```

```tsx
import { DevToolContainer } from 'react-state-custom/dev-tool'
import { ObjectDataView } from 'react-state-custom/dev-tool/obj-view'
import 'react-state-custom/style.css'
import 'react-obj-view/dist/react-obj-view.css'

<DevToolContainer Component={ObjectDataView} />
```

Or pass your own `Component`. It receives `{ name, value }` for each store, where `name` is the full context name (`"counter?initial=10"`, prefixed by the scope id inside a `StateScopeProvider`).

```tsx
<DevToolContainer Component={({ name, value }) => <pre>{name}: {JSON.stringify(value)}</pre>} />
```

## Embedding the panel

`DevToolState` is the panel without the trigger button, for embedding in your own debug UI. `StateView` renders one store. Both come from the same entry; see the [dev tools API](/api/dev-tools).

## Debugging without the UI

`AutoRootCtx` and `StateScopeProvider` accept `debugging`. With `true`, each store instance renders its state as a `<pre data-store="<store>?<params>">` element next to where the store hook runs, useful in tests and when the dev-tool bundle is not wanted:

```tsx
render(<><AutoRootCtx debugging /><App /></>)
expect(document.querySelector('[data-store="user?userId=42"]')!.textContent).toContain('"isLoading": false')
```

Pass a component instead of `true` to render the state your own way; it receives `{ name, value }` like a dev tool renderer. `formatState(value)` from the main entry is the JSON formatter used by both.
