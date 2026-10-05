# Scopes

::: warning Deprecated
`StateScopeProvider` is removed in 2.0: stores become global only. When two subtrees need separate instances of the same store, put what tells them apart in the params, `useDocument({ documentId, editorId })`, and every reader that passes the same params shares one instance. To start every store afresh (an example preview, a test), remount `AutoRootCtx` with a new `key`. This page documents the 1.x API. See [Migrating to 2.0](/guide/migrating-to-2#scopes).
:::

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

`storeRef(params)` always targets the **global** scope. Components inside a `StateScopeProvider` read their own instance with `useStore`, or through `useCtxState(params)`, which returns the scope's `Context` object.
