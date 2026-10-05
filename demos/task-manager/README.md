# Task manager: a developer-experience test

A task manager written the way the docs suggest, to see how the library holds up once the state gets complex. It runs in the browser (`yarn demo:tasks`) and as scenarios in jsdom. The scenarios measure rather than test: they print what happened (`[dx]`, `[fix]` and `[rt]` lines) and pass either way. `yarn test` leaves this folder out.

## In the browser

```bash
yarn demo:tasks   # http://localhost:5181 (the next free port if it is taken)
```

The number at the start of each row counts its renders. Things to try:

- **Delete a task** with "Row reads its task from: tasks store, no check". The list crashes: the deleted row renders once more with its task `undefined`. Switch to "checked before reading" (the default) or "the list's own store" and delete again.
- **Click a status** (sort by Title first, so the order stays) with each "Changing one task re-renders" option: every row, then one row with `React.memo`, then one row with the list reading its ids with `shallowEqual`.
- **Fail next save**, then change a status: it shows the new status at once and rolls back when the save fails.
- **Remote edit (socket)** changes a task from "the server"; **Backend calls** shows one `socket+` per open project, and `socket-` when you switch to "No project".
- **Edit a task**, type, close and reopen it: the draft is kept. Type quickly in **Search**: responses arrive out of order, the results match the last query.
- **Toggle Dev Tool** lists the live stores, such as `list`, `tasks`, `filters` and `search`.

## The stores (`app.tsx`)

| Store | What it does |
|---|---|
| `session` | the logged-in user |
| `tasks` per project | loads the tasks, optimistic edits that roll back on failure, undo, live socket updates |
| `filters` per project | status, "mine", sort; kept 60 s after the last reader leaves |
| `visible` per project | the filtered, sorted ids, derived from `tasks`, `filters` and `session` |
| `stats` per project | counts per status, derived from `tasks` |
| `task-detail` per task | the task (a selector on `tasks`) and its comments |
| `search` per project | a query whose earlier, slower response must not win |
| `draft` per task | the editor's unsaved title, kept 5 minutes after the editor closes |

The fake backend and socket at the top of `app.tsx` record every call in `calls`, so the scenarios can count fetches and subscriptions.

## Files

| File | What it shows |
|---|---|
| `app.tsx` | the stores and the components the scenarios render (`TaskRow`, `TaskList`, `Stats`, `Toolbar`, `Editor`) |
| `main.tsx`, `index.html`, `page.css`, `vite.config.mjs` | the browser page: the same stores, a `list` store that computes ids and tasks together, three kinds of row and the two switches |
| `scenarios.test.tsx` | A–K: load, edit one task, delete, failed edit and rollback, undo, socket, navigation, draft, search, login, actions on the first render |
| `fixes.test.tsx` | the fixes: a stable `ids` array, rows read from the derived store, the keyed-collection shape |
| `initial-state-types.tsx` | which keys `initialState` types as present |
| `initial-state-runtime.test.tsx` | a key typed present by mistake, undefined on the first render |

## Run

```bash
# the scenarios (jsdom)
yarn vitest run --config demos/task-manager/vitest.config.mjs

# the types, with noUncheckedIndexedAccess (part of yarn typecheck)
yarn tsc -p demos/task-manager
```

## What it found (1.6.0, jsdom)

- **Worked as plain React:** optimistic edit with rollback, undo, the out-of-order search, one socket subscription shared by every reader and closed when the project changes, filters kept across navigation while tasks reload, and the draft kept after the editor closes.
- **Deleting a task crashed its row** (scenario C) when the row read `tasks` while the list read ids from `visible`: `tasks` publishes one commit before `visible`, so the deleted row renders once with `undefined`. The same happens when coming back to a project within 100 ms. Reading rows from the derived store gives 0 such renders (`fixes.test.tsx`); `React.memo` does not help.
- **Editing one task re-rendered all 50 rows** (scenario B): `ids` is a new array whenever `tasks` changes, so the list re-renders and with it every row. `React.memo` on the row, or keeping the previous array while its contents are equal, brings it to 1. The page shows `React.memo` and a list that reads its ids with `shallowEqual`.
- **Actions are typed `T | undefined`** and are `undefined` on the first render (scenario K).
- **`initialState` with a plain string literal** (`{ status: 'loading' }`, no `as const`) types every key as present, actions included (`initial-state-types.tsx`), and such a key can be `undefined` on the first render (`initial-state-runtime.test.tsx`).

## What changed after 1.6.0

The library keeps its model: values from different stores can disagree for one render, and readers check before they read. What changed:

- **`initialState` types only the keys it holds**, and checks their values against the store's types: `{ status: 'loading' }` needs no `as const`, and `ids` stays optional (`initial-state-types.tsx`). The `as const` casts in `app.tsx` are gone.
- **`shallowEqual` is exported**, for selectors that return a new array with the same items. The page's third re-render option uses it, in place of a store that kept the previous array in a ref.
- **The demo type-checks with `noUncheckedIndexedAccess`**, so `tasks[id]` is `Task | undefined`. It flagged the row that crashed on delete, and a bug in `updateTask`: a task deleted while its save was in flight came back when the save or its rollback landed, half of it missing. `updateTask` now changes a task only while it exists. Action calls use `?.()`.
- **The docs** teach this: Getting started "Before the data arrives", How it works "Stores as services" and "Data across stores", and the Collections section of Selectors.

