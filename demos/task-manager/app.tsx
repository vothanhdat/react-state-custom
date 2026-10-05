// A task manager written the way the docs suggest: session, tasks per project (optimistic writes,
// undo, socket updates), filters, a derived visible list, stats, task detail per id, a search with
// an async race, and a draft that survives navigation. See README.md.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createStore } from '../../src'

export type Status = 'todo' | 'doing' | 'done'
export type Task = { id: string; title: string; status: Status; projectId: string; assignee?: string; updatedAt: number }
export type User = { id: string; name: string }

// ---------- fake backend ----------
export const db: Record<string, Task> = {}
export const calls: string[] = []
export const control = { failNextUpdate: false, delay: 5, searchDelays: [] as number[] }
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
export const api = {
  async listTasks(projectId: string) { calls.push('list:' + projectId); await wait(control.delay); return Object.values(db).filter(t => t.projectId === projectId).map(t => ({ ...t })) },
  async updateTask(id: string, patch: Partial<Task>) {
    calls.push('update:' + id); await wait(control.delay)
    if (control.failNextUpdate) { control.failNextUpdate = false; throw new Error('409 conflict') }
    db[id] = { ...db[id], ...patch, updatedAt: Date.now() }; return { ...db[id] }
  },
  async deleteTask(id: string) { calls.push('delete:' + id); await wait(control.delay); delete db[id] },
  async fetchComments(taskId: string) { calls.push('comments:' + taskId); await wait(control.delay); return [`first comment on ${taskId}`] },
  async search(projectId: string, q: string) {
    calls.push('search:' + q); await wait(control.searchDelays.shift() ?? control.delay)
    return Object.values(db).filter(t => t.projectId === projectId && t.title.includes(q)).map(t => t.id)
  },
}
type Listener = (t: Task) => void
const socketListeners = new Map<string, Set<Listener>>()
export const socket = {
  subscribe(projectId: string, fn: Listener) {
    calls.push('socket+:' + projectId)
    const set = socketListeners.get(projectId) ?? new Set(); set.add(fn); socketListeners.set(projectId, set)
    return () => { calls.push('socket-:' + projectId); set.delete(fn) }
  },
  emit(t: Task) { db[t.id] = t; socketListeners.get(t.projectId)?.forEach(fn => fn(t)) },
}

// ---------- 1. session (global) ----------
export const { useStore: useSession, getStore: getSession } = createStore('session', () => {
  const [user, setUser] = useState<User | null>(null)
  const login = (name: string) => setUser({ id: 'u-' + name, name })
  const logout = () => setUser(null)
  return { user, login, logout }
}, { initialState: { user: null } })

// ---------- 2. tasks of a project ----------
const byId = (list: Task[]) => Object.fromEntries(list.map(t => [t.id, t]))
export const { useStore: useTasks, getStore: getTasks } = createStore('tasks', ({ projectId }: { projectId: string }) => {
  const [tasks, setTasks] = useState<Record<string, Task>>({})
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string>()
  const [undoStack, setUndoStack] = useState<Record<string, Task>[]>([])

  useEffect(() => {
    let alive = true
    setStatus('loading')
    api.listTasks(projectId).then(list => { if (alive) { setTasks(byId(list)); setStatus('ready') } }, () => alive && setStatus('error'))
    return () => { alive = false }
  }, [projectId])

  // live updates while anyone looks at this project
  useEffect(() => socket.subscribe(projectId, t => setTasks(s => ({ ...s, [t.id]: t }))), [projectId])

  const updateTask = async (id: string, patch: Partial<Task>) => {
    const before = tasks[id]                       // latest render's value: the wrapper calls the latest closure
    setUndoStack(u => [...u, tasks])
    setTasks(s => ({ ...s, [id]: { ...s[id], ...patch } }))
    try {
      const saved = await api.updateTask(id, patch)
      setTasks(s => ({ ...s, [id]: saved }))
    } catch (e) {
      setTasks(s => ({ ...s, [id]: before }))      // roll back
      setError(String(e))
    }
  }
  const deleteTask = async (id: string) => {
    setUndoStack(u => [...u, tasks])
    setTasks(s => { const { [id]: _, ...rest } = s; return rest })
    await api.deleteTask(id)
  }
  const undo = () => {
    const prev = undoStack[undoStack.length - 1]
    if (!prev) return
    setUndoStack(u => u.slice(0, -1))
    setTasks(prev)
  }
  return { tasks, status, error, updateTask, deleteTask, undo, canUndo: undoStack.length > 0 }
}, { initialState: { tasks: {}, status: 'loading' as const, canUndo: false } })

// ---------- 3. filters of a project (UI state, kept 60 s after leaving) ----------
export const { useStore: useFilters } = createStore('filters', ({ projectId }: { projectId: string }) => {
  const [status, setStatus] = useState<Status | 'all'>('all')
  const [mine, setMine] = useState(false)
  const [sort, setSort] = useState<'title' | 'updated'>('updated')
  return { status, mine, sort, setStatus, setMine, setSort }
}, { initialState: { status: 'all' as const, mine: false, sort: 'updated' as const }, timeToClean: 60_000 })

// ---------- 4. derived: visible ids ----------
export const visibleIds = (tasks: Record<string, Task>, status: Status | 'all', mine: boolean, sort: 'title' | 'updated', user: User | null) =>
  Object.values(tasks)
    .filter(t => (status === 'all' || t.status === status) && (!mine || t.assignee === user?.id))
    .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : b.updatedAt - a.updatedAt)
    .map(t => t.id)

export const { useStore: useVisible } = createStore('visible', ({ projectId }: { projectId: string }) => {
  const { tasks } = useTasks({ projectId })
  const { status, mine, sort } = useFilters({ projectId })
  const { user } = useSession()
  const ids = useMemo(() => visibleIds(tasks, status, mine, sort, user), [tasks, status, mine, sort, user])
  const { updateTask } = useTasks({ projectId })
  // a cross-store action lives in the store that already reads everything it needs
  const assignVisibleToMe = () => { for (const id of ids) updateTask!(id, { assignee: user!.id }) }
  return { ids, assignVisibleToMe }
}, { initialState: { ids: [] as string[] } })

// ---------- 5. derived: stats ----------
export const { useStore: useStats } = createStore('stats', ({ projectId }: { projectId: string }) => {
  const { tasks } = useTasks({ projectId })
  const all = Object.values(tasks)
  return {
    todo: all.filter(t => t.status === 'todo').length,
    doing: all.filter(t => t.status === 'doing').length,
    done: all.filter(t => t.status === 'done').length,
  }
}, { initialState: { todo: 0, doing: 0, done: 0 } })

// ---------- 6. task detail: one instance per task ----------
export const { useStore: useTaskDetail } = createStore('task-detail', ({ projectId, taskId }: { projectId: string, taskId: string }) => {
  const task = useTasks({ projectId }, s => s.tasks[taskId])
  const [comments, setComments] = useState<string[]>()
  useEffect(() => { let alive = true; api.fetchComments(taskId).then(c => alive && setComments(c)); return () => { alive = false } }, [taskId])
  return { task, comments }
})

// ---------- 7. search with an async race ----------
export const { useStore: useSearch } = createStore('search', ({ projectId }: { projectId: string }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<string[]>([])
  useEffect(() => {
    if (!query) { setResults([]); return }
    let alive = true
    api.search(projectId, query).then(r => alive && setResults(r))
    return () => { alive = false }
  }, [projectId, query])
  return { query, setQuery, results }
}, { initialState: { query: '', results: [] as string[] } })

// ---------- 8. a draft that survives closing the editor ----------
export const { useStore: useDraft } = createStore('draft', ({ taskId }: { taskId: string }) => {
  const [title, setTitle] = useState<string>()
  return { title, setTitle }
}, { timeToClean: 5 * 60_000 })

// ---------- views ----------
export const renders: Record<string, number> = {}
export const zombies: string[] = []
export const step = { name: '' }
const count = (k: string) => { renders[k] = (renders[k] ?? 0) + 1 }

export const TaskRow = ({ projectId, id }: { projectId: string, id: string }) => {
  count('row:' + id)
  const task = useTasks({ projectId }, s => s.tasks[id])
  // The first version had no check and crashed on delete: `tasks` publishes one commit before
  // `visible` drops the id, so this row renders once more with `task` undefined.
  if (!task) { zombies.push(`${step.name}: ${id}`); return null }
  return <li data-id={id}>{task.title} [{task.status}]</li>
}
export const TaskList = ({ projectId }: { projectId: string }) => {
  count('list')
  const { ids } = useVisible({ projectId })
  return <ul>{ids.map(id => <TaskRow key={id} projectId={projectId} id={id} />)}</ul>
}
export const Stats = ({ projectId }: { projectId: string }) => {
  count('stats')
  const { todo, doing, done } = useStats({ projectId })
  return <p>{todo}/{doing}/{done}</p>
}
export const Toolbar = ({ projectId }: { projectId: string }) => {
  count('toolbar')
  const { setStatus, setMine } = useFilters({ projectId })
  const { undo, canUndo } = useTasks({ projectId })
  return <div>
    <button onClick={() => setStatus('done')}>done</button>
    <button onClick={() => setMine(true)}>mine</button>
    <button disabled={!canUndo} onClick={() => undo()}>undo</button>
  </div>
}
export const Editor = ({ projectId, taskId }: { projectId: string, taskId: string }) => {
  const { task } = useTaskDetail({ projectId, taskId })
  const { title, setTitle } = useDraft({ taskId })
  const { updateTask } = useTasks({ projectId })
  const value = title ?? task?.title ?? ''
  return <form onSubmit={e => { e.preventDefault(); updateTask(taskId, { title: value }); setTitle(undefined) }}>
    <input value={value} onChange={e => setTitle(e.target.value)} />
  </form>
}
