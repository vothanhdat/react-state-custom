# StateScopeProvider

::: warning Deprecated
Removed in 2.0, with scopes. Put what tells instances apart in the params instead: `useDocument({ documentId, editorId })`. See [Migrating to 2.0](/guide/migrating-to-2#scopes).
:::

Creates an isolated scope. Stores used inside it get their own instances, independent of the global scope and of any other `StateScopeProvider`, even when they share a definition and params. It acts as its own root: no `AutoRootCtx` is needed inside.

```ts
function StateScopeProvider(props: {
  children: React.ReactNode
  Wrapper?: React.ComponentType<{ children?: React.ReactNode }>
  debugging?: boolean | StateDebugRenderer
}): JSX.Element
```

## Props

`children` is the isolated subtree. `Wrapper` and `debugging` are forwarded to the scope's internal `AutoRootCtx`; see [AutoRootCtx](/api/auto-root-ctx).

## Behaviour

- Scopes nest; a store belongs to the innermost scope around its consumer.
- `storeRef()` does not see scoped instances. Read them with `useStore` inside the scope.
- The scope's stores are torn down when the provider unmounts.

## Example

```tsx
<AutoRootCtx />
<Editor />                     {/* global instance of useDocumentStore() */}
<StateScopeProvider>
  <Editor />                   {/* separate instance of useDocumentStore() */}
</StateScopeProvider>
```

See [Scopes](/guide/scopes).
