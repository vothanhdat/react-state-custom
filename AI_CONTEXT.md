# React State Custom - AI Context

**Target Audience:** AI Assistants (Gemini, ChatGPT, Claude, Copilot)
**Goal:** Generate idiomatic, high-performance code using `react-state-custom` 2.x.
**Full documentation:** https://vothanhdat.github.io/react-state-custom/docs/ (the [Rules](https://vothanhdat.github.io/react-state-custom/docs/guide/rules) page has the rules below with a page each).

---

## 🧠 The Model

A store is a custom hook that runs once per params instead of once per caller.

- `createStore(name, useHook)` registers it. The first caller of `useStore(params)` makes `<AutoRootCtx />` run `useHook(params)` and publish what it returns, key by key. Every caller with the same params reads that one instance and re-renders only for the keys it read. After the last reader leaves, the instance unmounts and its effects clean up.
- A store hook can use any hook, other stores included (no cycles): derived state is a store that reads another.
- Each store is a small service: it owns its data, its IO and its lifetime; others read what it publishes and call its actions. Stores are lazy, and eventually consistent with each other, so readers check values before using them.

## 🛠️ The API

```tsx
import { createStore, useMultipleStore, AutoRootCtx } from 'react-state-custom'

const { useStore, storeRef } = createStore(name, useHook, { timeToClean, schedule })

useStore(params?)                               // a proxy: the component re-renders for the keys it read
useStore(params, { select, isEqual, schedule }) // a selection
storeRef(params)                                // one instance, for code outside React: get, subscribe, retain
useMultipleStore(refs, { select, schedule })    // several instances in one call
<AutoRootCtx />                                 // mounted once: it runs the store hooks
```

Schedulers come from `react-state-custom/schedulers`, test helpers from `react-state-custom/testing`, the dev tool from `react-state-custom/dev-tool`. Nothing else exists since 2.0: never generate the 1.x APIs (`getStore`, `initialState`, `useStoreSuspense`, `useStoreStatus`, `useCtxState`, `StateScopeProvider`, `StoreErrorBoundary`, the `Wrapper`/`debugging` props, `AttachedComponent`, `preState`, a selector passed as a positional argument, `shallowEqual`, `createRootCtx`/`createAutoCtx`, the `useData*` primitives).

---

## 📏 The Rules

1. **A store hook returns an object.** `return { count, setCount }`, never `return useState(0)`: each key is published and tracked on its own.

2. **Mount one `<AutoRootCtx />`, inside the providers your stores use.** Store hooks run in it, so `useContext` in a store reads the providers above it (query client, router, i18n), not the ones around the reader. There is no provider per store. A new `key` on it starts every store afresh.

3. **Same name and params, same instance.** Params say which instance; they are not props or initial values: `useTasks({ projectId })`, not `useCounter({ initial: 10 })`. They are an object of primitives; a store without params is called `useX()`. Callers with the same params share everything the hook holds, so keep per-view state (a cursor, a selection) in the component, or in the params (`{ documentId, viewId }`). Store names are global: keep them unique.

4. **Every key is `undefined` until the store has run**, actions included, and typed optional: a store starts when its first reader mounts. Default at the read (`count ?? 0`, `const { isLoading = true } = ...`; a constant defined once where identity matters). Never cast it away with `!` or `as Required<...>`.

5. **Call actions with `?.()` from handlers, and load in the store.** A call during render or from a reader's mount effect comes too early and does nothing. Fetches, subscriptions and polls go in the store's own effects. An effect that only calls an action lists it as a dependency and returns early while it is missing; an effect that does other work (a socket) keeps actions out of its dependencies (read them through `useEffectEvent` or a ref, or subscribe to an event of the other store).

6. **Read during render.** Destructure at the top of the component. The proxy tracks reads during that render only and is a new object every render (React Compiler safe): never spread it, keep it, list it as a dependency or pass it to a child (pass the values, or call the store in the child). In a handler, use the value you destructured, or `storeRef(params).get()` for the latest. Calling an action through the proxy is fine.

7. **Tracking is per top-level key.** Return fields as their own keys, and flatten a nested source once in a store above (`return { ...player }`). Read deep or derived values with `useX(params, { select })`, compared shallowly by default (`isEqual` changes that). Options go after the params: `useX(undefined, { select })` for a store without params.

8. **Each store layer adds a commit.** A store publishes one commit after the stores it reads, so for one render a component that reads two layers can see a new value next to an old one. Check before reading (turn on `noUncheckedIndexedAccess`; a row returns `null` when its item is gone), join by id rather than by index, and make decisions that need several stores in one store.

9. **A store that throws throws in its readers.** Its instance is disabled, the other stores keep running, and its readers throw its error for their error boundary: put boundaries around the parts of the screen that can fail on their own. Expected failures (a request, a dropped socket) are state: catch them in the hook, publish an `error` and a retry action. Report with React's `onCaughtError` root option.

10. **An instance stops when its last reader leaves**, `timeToClean` ms later, its effects running until then. `timeToClean: Infinity` keeps it until `AutoRootCtx` unmounts (a session, a connection). `storeRef(params).retain()` keeps it running with no component: for code outside React, or a task that outlives its screen (`useEffect(() => { if (uploading) return uploadRef({ id }).retain() }, [uploading, id])`).

---

## 🏗️ The Golden Path: Stores in Layers

Build an app in four layers, imports going down only:

```
domain        plain functions and types: rules, arithmetic, formatting. No React, no stores
stores/core   stores that own IO and data: fetches, sockets, the session. Nothing about the UI
stores/ui     view-models: what the screens render, built from core stores
components    views: read stores/ui only, plus their own local state
```

```ts
// domain/tasks.ts
export type Task = { id: string; title: string; done: boolean }
export const isOpen = (task: Task) => !task.done
```

```ts
// stores/core/tasks.ts: owns the IO and the data, knows nothing about the UI
import { useEffect, useState } from 'react'
import { createStore } from 'react-state-custom'
import type { Task } from '../../domain/tasks'
import { api } from '../../api'

export type Outcome = { ok: true } | { ok: false; error: string }

const useTasksState = ({ projectId }: { projectId: string }) => {
  const [tasks, setTasks] = useState<Record<string, Task>>()   // keyed by id, not an array
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {                                             // loading starts in the store
    let cancelled = false
    setError(undefined)
    api.listTasks(projectId).then(
      (list: Task[]) => { if (!cancelled) setTasks(Object.fromEntries(list.map(t => [t.id, t]))) },
      (e: unknown) => { if (!cancelled) setError(String(e)) },  // an expected failure is state
    )
    return () => { cancelled = true }
  }, [projectId, attempt])

  // a command returns its outcome; the caller decides what to show
  const toggle = async (id: string): Promise<Outcome> => {
    try {
      const task: Task = await api.toggleTask(projectId, id)
      setTasks(prev => prev && { ...prev, [id]: task })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  }

  return { tasks, error, isLoading: !tasks && !error, reload: () => setAttempt(a => a + 1), toggle }
}
export const { useStore: useTasks } = createStore('tasks', useTasksState, { timeToClean: 60_000 })
```

```ts
// stores/ui/taskList.ts: what the screen shows, built from the core store
import { useState } from 'react'
import { createStore } from 'react-state-custom'
import { isOpen, type Task } from '../../domain/tasks'
import { useTasks } from '../core/tasks'

// a store: it holds state of its own (the filter, the last failure) and several components read it
const useTaskListState = ({ projectId }: { projectId: string }) => {
  const { tasks, error, isLoading, reload, toggle } = useTasks({ projectId })
  const [showDone, setShowDone] = useState(true)
  const [failed, setFailed] = useState<string>()
  const all: Task[] = tasks ? Object.values(tasks) : []
  return {
    ids: all.filter(t => showDone || isOpen(t)).map(t => t.id),
    left: all.filter(isOpen).length,
    error, isLoading, reload, showDone, setShowDone, failed,
    toggle: async (id: string) => {
      const outcome = await toggle?.(id)
      setFailed(outcome && !outcome.ok ? outcome.error : undefined)
    },
  }
}
export const { useStore: useTaskList } = createStore('task-list', useTaskListState)

// one row reads one task and nothing else needs it: a plain hook, which costs no commit
export const useTaskRow = (projectId: string, id: string) =>
  useTasks({ projectId }, { select: s => s.tasks?.[id] })
```

```tsx
// components/TaskList.tsx: reads stores/ui only
import { memo } from 'react'
import { useTaskList, useTaskRow } from '../stores/ui/taskList'

const TaskRow = memo(({ projectId, id }: { projectId: string; id: string }) => {
  const task = useTaskRow(projectId, id)
  const { toggle } = useTaskList({ projectId })
  if (!task) return null              // deleted: the list, one store later, still had its id
  return <li onClick={() => toggle?.(id)}>{task.done ? '✓ ' : ''}{task.title}</li>
})

export const TaskList = ({ projectId }: { projectId: string }) => {
  const { isLoading = true, error, reload, failed, left } = useTaskList({ projectId })
  const ids = useTaskList({ projectId }, { select: s => s.ids ?? [] })
  if (error) return <p>{error} <button onClick={() => reload?.()}>Retry</button></p>
  if (isLoading) return <p>Loading…</p>
  return (
    <>
      {failed && <p role="alert">{failed}</p>}
      <ul>{ids.map(id => <TaskRow key={id} projectId={projectId} id={id} />)}</ul>
      <small>{left} left</small>
    </>
  )
}
```

```tsx
// App.tsx: one AutoRootCtx, inside the providers the stores read
export const App = () => (
  <QueryClientProvider client={queryClient}>
    <AutoRootCtx />
    <TaskList projectId="inbox" />
  </QueryClientProvider>
)
```

- **Core stores** return outcomes from commands (`{ ok, error }`) or emit events. No toasts, navigation or formatting, no imports from `stores/ui` or components.
- **The UI layer** decides presentation. A piece is a store when it holds state, several components read it, or it must run once (a listener that turns events into toasts); otherwise it is a plain hook, which costs no commit.
- **Check the import direction with a test**: [Organizing stores in layers](https://vothanhdat.github.io/react-state-custom/docs/guide/layers#enforce-it-with-a-test) has one to copy.

---

## 🧩 Patterns

-   **Collections**: items that change independently are keyed by id, never an array under one key. Rows take an id, read their item with `{ select }`, are wrapped in `memo` and return `null` when it is missing; the list reads its ids with `{ select: s => s.ids ?? [] }`. An item with its own fetch or subscription is a parameterized store, `useItem({ id })`, or one collection store with a `subscribe(id)` action that counts readers.
-   **Many instances**: never call `useStore` in a loop. `useMultipleStore(ids.map(id => itemRef({ id })))` returns a proxy per instance, and `useMultipleStore(refs, { select: states => ... })` one value over all of them, in components and in store hooks.
-   **Update cadence**: a reader of fast data (prices, sensors, logs) picks how often it renders: `useX(params, { schedule: frame() })`, or `throttle(ms)`, `debounce(ms, { maxWait })`, `idle(ms)`, `sync()` from `react-state-custom/schedulers` (call the factories inline). `createStore(name, fn, { schedule })` sets the default. Only that reader waits: the store, `get()` and actions are immediate. Schedule leaf views (charts, tables, logs), not readers that decide. A store fed by a socket publishes once per frame with `useFrameState(initial)`, or `scheduled(() => setX(snapshot()), frame())` called per message (`.cancel()` in the cleanup).
-   **Events**: something that happens once (a fill) goes out through `onFill(listener)`, which returns the unsubscribe. Call listeners after the store accepted the message, each in try/catch, with the whole event in the payload. The listener that shows a toast is a store in `stores/ui`, started once near the root, not a plain hook (two callers would show two toasts).
-   **Outside React**: `storeRef(params).get()`, `.subscribe(listener)` and `.retain()`, for socket handlers, routers, tests and handlers that need the latest value. A ref only names the instance.
-   **Tests**, with `react-state-custom/testing`: `resetStores()` after each test (after `cleanup()`); `mockStore(useX, values | hook)` before rendering and `act(() => mock.set({...}))` to change it; `storeHandle(useX, params)` when the module exports only `useStore`; `await waitForStore(useX, params, ['key'])`; `act(() => { flushScheduled() })` for scheduled renders. Test each layer over mocks of the one below: core stores over a faked transport, UI stores over mocked core stores, views over mocked UI stores.
-   **SSR / Next.js**: SSR-safe. On the server `useStore` returns `{}` and no store runs; stores run after hydration. In the App Router, `AutoRootCtx` and every `useStore` caller live in a `'use client'` module.
-   **Dev tool**: `DevToolContainer` from `react-state-custom/dev-tool` plus `import 'react-state-custom/style.css'`; `ObjectDataView` from `react-state-custom/dev-tool/obj-view` needs the optional peer `react-obj-view`.
