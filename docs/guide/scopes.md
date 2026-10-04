# Scopes

`AutoRootCtx` is the global scope: every `useStore` call in the tree shares its instances. `StateScopeProvider` creates an isolated scope with its own instances of every store, even when they share a definition and params.

```tsx
import { AutoRootCtx, StateScopeProvider } from 'react-state-custom'

function App() {
  return (
    <>
      <AutoRootCtx />
      <Editor />                 {/* global instance of useDocumentStore() */}

      <StateScopeProvider>
        <Editor />               {/* separate instance, same definition */}
      </StateScopeProvider>
    </>
  )
}
```

A `StateScopeProvider` is its own root: it does not need an `AutoRootCtx` inside it. It accepts the same `Wrapper` and `debugging` props as `AutoRootCtx`.

Every `StateScopeProvider` is a separate scope, also when the page has several React roots that each mount one, such as islands hydrated from server HTML.

## Use cases

- Rendering several independent copies of a feature side by side: two editors, a comparison view, a multi-tab workspace. To share part of the state between copies, such as the document two editors show, use params instead; see [What an instance shares](/guide/parameterized-stores#what-an-instance-shares).
- Isolating a preview or a modal from the main application state.
- Test isolation: each test renders its subject inside a fresh `StateScopeProvider`. See [Testing](/guide/testing).

## Nesting

Scopes nest. A store used inside an inner `StateScopeProvider` belongs to the innermost scope. Outer scopes and the global scope do not see it.

## Reaching a scoped store from outside React

`getStore(params)` always targets the **global** scope. Components inside a `StateScopeProvider` reach their own instance through `useCtxState(params)`, which returns the scope's `Context` object, and can subscribe or read `ctx.data` from there. The [Outside React](/guide/outside-react) page shows both.
