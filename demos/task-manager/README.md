# Task manager: a developer-experience test

A task manager written the way the docs suggest, to see how the library holds up once the state gets complex. These are measurement scenarios, not tests: they print what happened (`[dx]`, `[fix]` and `[rt]` lines) and pass either way. `yarn test` leaves this folder out.

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
| `app.tsx` | the stores and the components (`TaskRow`, `TaskList`, `Stats`, `Toolbar`, `Editor`) |
| `scenarios.test.tsx` | A–K: load, edit one task, delete, failed edit and rollback, undo, socket, navigation, draft, search, login, actions on the first render |
| `fixes.test.tsx` | the fixes: a stable `ids` array, rows read from the derived store, the keyed-collection shape |
| `initial-state-types.tsx` | which keys `initialState` types as present, with the current signature and with a `const` type parameter |
| `initial-state-runtime.test.tsx` | a key typed present by mistake, undefined on the first render |

## Run

```bash
# the scenarios (jsdom)
yarn vitest run --config demos/task-manager/vitest.config.mjs

# the types: errors are expected, they are the findings
yarn tsc -p demos/task-manager
```

The type check reports the 6 action calls in `app.tsx` that TypeScript sees as possibly `undefined`, and three errors in `initial-state-types.tsx`: two deliberate ones whose messages print the probe results (`"present"` / `"optional"` per key), and the function form `initialState: () => ({ status: 'loading' })`, which does not compile with the current signature.

## What it found (1.6.0, jsdom)

- **Worked as plain React:** optimistic edit with rollback, undo, the out-of-order search, one socket subscription shared by every reader and closed when the project changes, filters kept across navigation while tasks reload, and the draft kept after the editor closes.
- **Deleting a task crashed its row** (scenario C) when the row read `tasks` while the list read ids from `visible`: `tasks` publishes one commit before `visible`, so the deleted row renders once with `undefined`. The same happens when coming back to a project within 100 ms. Reading rows from the derived store gives 0 such renders (`fixes.test.tsx`); `React.memo` does not help.
- **Editing one task re-rendered all 50 rows** (scenario B): `ids` is a new array whenever `tasks` changes. Keeping the previous array while its contents are equal brings it to 1.
- **Actions are typed `T | undefined`** and are `undefined` on the first render (scenario K).
- **`initialState` with a plain string literal** (`{ status: 'loading' }`, no `as const`) types every key as present, actions included (`initial-state-types.tsx`), and such a key can be `undefined` on the first render (`initial-state-runtime.test.tsx`).
