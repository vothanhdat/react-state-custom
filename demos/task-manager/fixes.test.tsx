import React, { useMemo, useRef, useState } from 'react'
import { render, act, cleanup, configure } from '@testing-library/react'
import { AutoRootCtx, createStore } from '../../src'
import { resetStores } from '../../src/testing'

configure({ reactStrictMode: false })
const flush = (ms = 5) => act(() => new Promise(r => setTimeout(r, ms)))
const log = (...a: unknown[]) => console.log('[fix]', ...a)
afterEach(() => { cleanup(); resetStores() })

type Task = { id: string; title: string; done: boolean }
const shallowEqual = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((x, i) => Object.is(x, b[i]))
const N = 50
const seedTasks = () => Object.fromEntries(Array.from({ length: N }, (_, i) => ['t' + i, { id: 't' + i, title: 'task ' + i, done: false }]))

// source + derived, as written first
const { useStore: useTasks, storeRef: tasksRef } = createStore('fx-tasks', () => {
  const [tasks, setTasks] = useState<Record<string, Task>>(seedTasks)
  const toggle = (id: string) => setTasks(s => ({ ...s, [id]: { ...s[id], done: !s[id].done } }))
  const remove = (id: string) => setTasks(s => { const { [id]: _, ...rest } = s; return rest })
  return { tasks, toggle, remove }
}, { initialState: { tasks: {} } })

// variant 1: the derived store keeps the previous array while its content is the same
const useStableArray = <T,>(next: T[]) => {
  const ref = useRef(next)
  if (!shallowEqual(ref.current, next)) ref.current = next
  return ref.current
}
const { useStore: useVisible } = createStore('fx-visible', () => {
  const { tasks } = useTasks()
  const ids = useStableArray(useMemo(() => Object.keys(tasks), [tasks]))
  return { ids, tasks }                       // variant 2: re-export the source the rows read
}, { initialState: { ids: [] as string[], tasks: {} as Record<string, Task> } })

const rows: Record<string, number> = {}
let zombies = 0
const RowFromSource = React.memo(({ id }: { id: string }) => {
  rows[id] = (rows[id] ?? 0) + 1
  const t = useTasks(undefined, { select: s => s.tasks[id] })
  if (!t) { zombies++; return null }
  return <li>{t.title}</li>
})
const RowFromDerived = ({ id }: { id: string }) => {
  rows[id] = (rows[id] ?? 0) + 1
  const t = useVisible(undefined, { select: s => s.tasks[id] })
  if (!t) { zombies++; return null }
  return <li>{t.title}</li>
}

it('ids kept stable in the store, rows unchanged', async () => {
  const List = () => <ul>{useVisible().ids.map(id => <RowFromDerived key={id} id={id} />)}</ul>
  render(<><AutoRootCtx /><List /></>)
  await flush()
  for (const k in rows) delete rows[k]
  await act(async () => { tasksRef().get().toggle!('t3') })
  log('stable ids, rows read from derived: rows rendered on one toggle', Object.keys(rows).length)
  zombies = 0
  await act(async () => { tasksRef().get().remove!('t4') })
  await flush()
  log('rows read from derived: undefined renders on delete', zombies)
})

it('rows read from the source, memoized', async () => {
  const List = () => <ul>{useVisible().ids.map(id => <RowFromSource key={id} id={id} />)}</ul>
  render(<><AutoRootCtx /><List /></>)
  await flush()
  zombies = 0
  await act(async () => { tasksRef().get().remove!('t4') })
  await flush()
  log('rows read from source (memo): undefined renders on delete', zombies)
})

// the docs' collection shape: one key per task
const { useStore: useKeyed, storeRef: keyedRef } = createStore('fx-keyed', () => {
  const [tasks, setTasks] = useState<Record<string, Task>>(seedTasks)
  const toggle = (id: string) => setTasks(s => ({ ...s, [id]: { ...s[id], done: !s[id].done } }))
  return { ...tasks, toggle } as Record<string, Task> & { toggle: typeof toggle }
})
it('keyed collection', async () => {
  const Row = ({ id }: { id: string }) => { rows[id] = (rows[id] ?? 0) + 1; const t = useKeyed()[id]; return <li>{t?.title}</li> }
  const List = () => <ul>{Object.keys(useKeyed()).filter(k => k !== 'toggle').map(id => <Row key={id} id={id} />)}</ul>
  render(<><AutoRootCtx /><List /></>)
  await flush()
  for (const k in rows) delete rows[k]
  await act(async () => { keyedRef().get().toggle!('t3') })
  log('keyed: rows rendered on one toggle', Object.keys(rows).length)
})
