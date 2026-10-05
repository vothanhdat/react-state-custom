# Parameterized stores

Params are serialized into the store's identity, so the same definition can serve many independent instances.

```ts
const { useStore: useTodoStore } = createStore('todos', useTodoState)

useTodoStore({ listId: 'work' })     // instance A
useTodoStore({ listId: 'personal' }) // instance B
useTodoStore({ listId: 'work' })     // instance A again, shared
```

Each instance runs its own copy of the hook with its own state and effects, and is torn down independently when its last consumer leaves.

## Rules

- **Params must be primitives**: `string`, `number`, `bigint`, `boolean`, `null` or `undefined`. Passing an object, array or function as a param throws, because they cannot be serialized into a stable identity, and TypeScript rejects a params type with such a value. Params and state may be declared with `interface` or `type`.
- **Key order does not matter.** `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` are the same instance.
- **Values are URI-encoded.** `=`, `&` and `?` inside a value cannot collide with another params object. The identity of `{ listId: 'work' }` under the name `todos` is `todos?listId=work`.
- **`undefined` means absent.** `{ listId: 'work', filter: undefined }` and `{ listId: 'work' }` are the same instance, so optional params can be passed straight through.
- **Types stay apart.** `{ id: 1 }` and `{ id: '1' }` are different instances: a string that reads like a number, bigint, boolean or `null` is quoted in the identity (`id='1'`), and a bigint ends in `n`.

## What an instance shares

Callers with the same params share everything the hook holds, not only the values they came for. Put in a store what every caller should see, and keep what belongs to one view outside it.

Two editors open on the same document show the same text, but each has its own cursor, selection and undo history:

```tsx
// shared: one instance per document, however many editors show it
const useDocumentState = ({ documentId }: { documentId: string }) => {
  const [text, setText] = useState('')
  useEffect(() => documents.subscribe(documentId, setText), [documentId])
  return { text, setText }
}
export const { useStore: useDocument } = createStore('document', useDocumentState)

// per view: component state
const Editor = ({ documentId }: { documentId: string }) => {
  const { text, setText } = useDocument({ documentId })
  const [selection, setSelection] = useState<{ start: number, end: number }>()
  const [undo, setUndo] = useState<string[]>([])
  ...
}
```

When the per-view part becomes a store of its own, because several components of one editor read it, give it its own identity: `useEditorView({ documentId, viewId })`. When two copies must not share anything, the document included, put what tells them apart in the params of every store they use: `useDocument({ documentId, copy })`.

## Stores without params

A store whose hook takes no required params can be consumed as `useStore()`.

```ts
const useSettingsState = () => { ... }
const { useStore: useSettingsStore } = createStore('settings', useSettingsState)

const { theme } = useSettingsStore()
```

Optional params work the same way: `useStore()` and `useStore({ initial: 10 })` are two instances.

## Params that are not primitives

When the natural key is an object, pass an id and look the object up inside the hook:

```ts
// instead of useStore({ user })
const useUserCartState = ({ userId }: { userId: string }) => {
  const { user } = useUserStore({ userId })
  ...
}
```

Composing stores this way keeps every instance identity serializable and lets the cart follow the user store's updates. See [Composing stores](/guide/composing-stores).

## Changing params

A component that calls `useStore({ listId })` with a changing `listId` switches instances: it subscribes to the new instance, and the old instance is torn down once no other consumer reads it (after `timeToClean`). State is not carried over between instances. If you want the old instance to survive a quick switch back, give the store a `timeToClean`.
