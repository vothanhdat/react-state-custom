// The browser page for the task manager: yarn demo:tasks
// It renders the stores of app.tsx and two switches that show what the scenarios found.
import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AutoRootCtx, createStore } from '../../src'
import { DevToolContainer } from '../../src/dev-tool'
import '../../src/dev-tool/DevTool.css'
import './page.css'
import {
  calls, control, db, socket, visibleIds, type Status, type Task,
  useDraft, useFilters, useSearch, useSession, useStats, useTaskDetail, useTasks, useVisible,
} from './app'

// ---------- data ----------
const titles: Record<string, string[]> = {
  p1: ['Write onboarding docs', 'Fix login redirect', 'Design settings page', 'Add CSV export', 'Review pricing copy',
    'Upgrade React', 'Flaky upload test', 'Dark mode colors', 'Rate-limit the API', 'Empty state for search',
    'Profile page avatar', 'Release notes 2.1'],
  p2: ['Plan the offsite', 'Book the venue', 'Order team shirts', 'Collect dietary needs', 'Agenda draft', 'Travel budget'],
}
const statuses: Status[] = ['todo', 'doing', 'done']
for (const [projectId, list] of Object.entries(titles)) {
  list.forEach((title, i) => {
    const id = `${projectId}-t${String(i).padStart(2, '0')}`
    db[id] = { id, title, projectId, status: statuses[i % 3], assignee: i % 4 === 0 ? 'u-dat' : undefined, updatedAt: i }
  })
}
control.delay = 350   // slow enough to see loading, optimistic edits and rollbacks

// ---------- the fixed list: ids and tasks from one store ----------
const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

// Computes the ids from `tasks` in the same render, so ids and tasks are published together.
// With `stable`, it keeps the previous array while the ids are the same.
const { useStore: useList } = createStore('list', ({ projectId, stable }: { projectId: string, stable: boolean }) => {
  const { tasks } = useTasks({ projectId })
  const { status, mine, sort } = useFilters({ projectId })
  const { user } = useSession()
  const next = useMemo(() => visibleIds(tasks, status, mine, sort, user), [tasks, status, mine, sort, user])
  const kept = useRef(next)
  if (!stable || !sameIds(kept.current, next)) kept.current = next
  return { ids: kept.current, tasks }
}, { initialState: { ids: [] as string[], tasks: {} as Record<string, Task> } })

// ---------- rows ----------
type RowProps = { projectId: string, id: string, stable: boolean, selected: boolean, onOpen: (id: string) => void }
const next: Record<Status, Status> = { todo: 'doing', doing: 'done', done: 'todo' }

const RowView = ({ task, projectId, selected, onOpen }: { task: Task } & Omit<RowProps, 'id' | 'stable'>) => {
  const renders = useRef(0)
  renders.current++
  const { updateTask, deleteTask } = useTasks({ projectId })
  return <li className={selected ? 'row selected' : 'row'}>
    <span key={renders.current} className="renders" title="times this row rendered">{renders.current}</span>
    <button className={'status ' + task.status} onClick={() => updateTask?.(task.id, { status: next[task.status] })}>{task.status}</button>
    <button className="title" onClick={() => onOpen(task.id)}>{task.title}</button>
    {task.assignee && <span className="assignee">@{task.assignee.slice(2)}</span>}
    <button className="delete" title="Delete" onClick={() => deleteTask?.(task.id)}>✕</button>
  </li>
}

// As first written: the list reads ids from one store, the row reads its task from `tasks`.
const RowFromTasks = (p: RowProps) => {
  const task = useTasks({ projectId: p.projectId }, s => s.tasks[p.id])
  return <RowView task={task} {...p} />
}
// Fixed: the row reads its task from the store that gave the list its ids.
const RowFromList = (p: RowProps) => {
  const task = useList({ projectId: p.projectId, stable: p.stable }, s => s.tasks[p.id])
  return <RowView task={task} {...p} />
}
const rows = {
  tasks: { plain: RowFromTasks, memo: memo(RowFromTasks) },
  list: { plain: RowFromList, memo: memo(RowFromList) },
}

type Source = keyof typeof rows
type Rerender = 'none' | 'memo' | 'stable'

const TaskList = ({ projectId, source, rerender, selected, onOpen }: {
  projectId: string, source: Source, rerender: Rerender, selected?: string, onOpen: (id: string) => void
}) => {
  const stable = rerender === 'stable'
  const { ids } = useList({ projectId, stable })
  const { status } = useTasks({ projectId })
  const Row = rows[source][rerender === 'memo' ? 'memo' : 'plain']
  if (status === 'loading') return <p className="muted">Loading…</p>
  if (!ids.length) return <p className="muted">No task matches the filters.</p>
  return <ul className="list">
    {ids.map(id => <Row key={id} projectId={projectId} id={id} stable={stable} selected={id === selected} onOpen={onOpen} />)}
  </ul>
}

class ListBoundary extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return <div className="crash">
      <strong>The list crashed:</strong> <code>{this.state.error.message}</code>
      <p>The deleted row rendered once more with its task <code>undefined</code>: <code>tasks</code> published the delete
        one commit before the list store dropped the id. Switch “Row reads its task from” to the list store, then delete again.</p>
      <button onClick={() => this.setState({ error: undefined })}>Render the list again</button>
    </div>
  }
}

// ---------- panels ----------
const Toolbar = ({ projectId }: { projectId: string }) => {
  const { status, mine, sort, setStatus, setMine, setSort } = useFilters({ projectId })
  const { undo, canUndo, error } = useTasks({ projectId })
  const { assignVisibleToMe } = useVisible({ projectId })
  const { user } = useSession()
  useTick(250)   // control.failNextUpdate is a plain variable: re-read it a few times a second
  const armed = control.failNextUpdate
  return <div className="toolbar">
    <select value={status} onChange={e => setStatus?.(e.target.value as Status | 'all')}>
      <option value="all">All</option><option value="todo">Todo</option><option value="doing">Doing</option><option value="done">Done</option>
    </select>
    <label><input type="checkbox" checked={mine} disabled={!user} onChange={e => setMine?.(e.target.checked)} /> Only mine</label>
    <select value={sort} onChange={e => setSort?.(e.target.value as 'title' | 'updated')}>
      <option value="updated">Recently updated</option><option value="title">Title</option>
    </select>
    <button disabled={!canUndo} onClick={() => undo?.()}>Undo</button>
    <button disabled={!user} onClick={() => assignVisibleToMe?.()}>Assign shown to me</button>
    <button className={armed ? 'armed' : ''} onClick={() => { control.failNextUpdate = true }}>
      {armed ? 'Next save will fail' : 'Fail next save'}
    </button>
    <button onClick={() => remoteEdit(projectId)}>Remote edit (socket)</button>
    {error && <span className="error">Last save failed, rolled back: {error}</span>}
  </div>
}

const remoteEdit = (projectId: string) => {
  const mineOnly = Object.values(db).filter(t => t.projectId === projectId)
  const t = mineOnly[Math.floor(Math.random() * mineOnly.length)]
  if (t) socket.emit({ ...t, title: t.title.replace(/ \(remote \d+\)$/, '') + ` (remote ${Math.floor(Math.random() * 100)})`, updatedAt: Date.now() })
}

const Stats = ({ projectId }: { projectId: string }) => {
  const { todo, doing, done } = useStats({ projectId })
  return <p className="stats"><span className="status todo">todo {todo}</span> <span className="status doing">doing {doing}</span> <span className="status done">done {done}</span></p>
}

const Editor = ({ projectId, taskId, onClose }: { projectId: string, taskId: string, onClose: () => void }) => {
  const { task, comments } = useTaskDetail({ projectId, taskId })
  const { title, setTitle } = useDraft({ taskId })
  const { updateTask } = useTasks({ projectId })
  const value = title ?? task?.title ?? ''
  return <section className="panel">
    <h3>Edit task <button className="close" onClick={onClose}>Close</button></h3>
    {!task ? <p className="muted">This task no longer exists.</p> : <>
      <form onSubmit={e => { e.preventDefault(); updateTask?.(taskId, { title: value }); setTitle?.(undefined) }}>
        <input value={value} onChange={e => setTitle?.(e.target.value)} />
        <button type="submit" disabled={title === undefined}>Save</button>
      </form>
      <p className="muted">{title !== undefined ? 'Unsaved draft: close and reopen this task, it is kept for 5 minutes.' : 'Type to start a draft.'}</p>
      <p className="muted">Comments: {comments ? comments.join(' · ') : 'loading…'}</p>
    </>}
  </section>
}

const Search = ({ projectId }: { projectId: string }) => {
  const { query, setQuery, results } = useSearch({ projectId })
  const sent = calls.filter(c => c.startsWith('search:')).length
  return <section className="panel">
    <h3>Search</h3>
    <input placeholder="Type quickly: responses arrive out of order" value={query}
      onChange={e => { control.searchDelays.push(Math.round(100 + Math.random() * 900)); setQuery?.(e.target.value) }} />
    <p className="muted">{sent} requests sent; the results always match the last query.</p>
    <ul className="results">{results.map(id => <li key={id}>{db[id]?.title ?? id}</li>)}</ul>
  </section>
}

const useTick = (ms: number) => {
  const [, setN] = useState(0)
  useEffect(() => { const t = setInterval(() => setN(n => n + 1), ms); return () => clearInterval(t) }, [ms])
}

const CallLog = () => {
  useTick(250)
  return <section className="panel">
    <h3>Backend calls <span className="muted">({calls.length})</span></h3>
    <ol className="log" start={Math.max(1, calls.length - 13)}>{calls.slice(-14).map((c, i) => <li key={calls.length - 14 + i}>{c}</li>)}</ol>
    <p className="muted"><code>socket+</code>/<code>socket-</code>: one subscription per open project, whatever the number of readers.</p>
  </section>
}

// ---------- page ----------
const App = () => {
  const [projectId, setProjectId] = useState<string | null>('p1')
  const [source, setSource] = useState<Source>('tasks')
  const [rerender, setRerender] = useState<Rerender>('none')
  const [selected, setSelected] = useState<string>()
  const { user, login, logout } = useSession()
  const project = (id: string | null) => { setProjectId(id); setSelected(undefined) }

  return <div className="page">
    <header>
      <h1>Task manager <span className="muted">react-state-custom demo</span></h1>
      {user ? <span>Logged in as <b>{user.name}</b> <button onClick={() => logout?.()}>Log out</button></span>
        : <button onClick={() => login?.('dat')}>Log in as dat</button>}
    </header>

    <nav className="tabs">
      {(['p1', 'p2'] as const).map(id => <button key={id} aria-pressed={projectId === id} onClick={() => project(id)}>
        {id === 'p1' ? 'Product' : 'Offsite'}</button>)}
      <button aria-pressed={projectId === null} onClick={() => project(null)}>No project</button>
      <span className="muted">Leave a project: its tasks and socket are released, its filters are kept 60 s.</span>
    </nav>

    <div className="modes">
      <label>Row reads its task from
        <select value={source} onChange={e => setSource(e.target.value as Source)}>
          <option value="tasks">tasks store (as first written: delete crashes)</option>
          <option value="list">the list's own store (fixed)</option>
        </select>
      </label>
      <label>Changing one task re-renders
        <select value={rerender} onChange={e => setRerender(e.target.value as Rerender)}>
          <option value="none">every row (new ids array)</option>
          <option value="memo">one row: React.memo on rows</option>
          <option value="stable">one row: ids kept while equal</option>
        </select>
      </label>
      <span className="muted">The number at the start of each row counts its renders. Click a status to change it; sort by Title to keep
        the order fixed (a save sets “updated”, which moves the task to the top under “Recently updated”).</span>
    </div>

    {projectId ? <main>
      <div className="main">
        <Toolbar projectId={projectId} />
        <Stats projectId={projectId} />
        <ListBoundary key={source + rerender + projectId}>
          <TaskList projectId={projectId} source={source} rerender={rerender} selected={selected} onOpen={setSelected} />
        </ListBoundary>
      </div>
      <aside>
        {selected && <Editor projectId={projectId} taskId={selected} onClose={() => setSelected(undefined)} />}
        <Search projectId={projectId} />
        <CallLog />
      </aside>
    </main> : <main><div className="main"><p className="muted">No project open. Open the dev tool below to see which stores are still alive.</p></div><aside><CallLog /></aside></main>}

    <DevToolContainer />
  </div>
}

createRoot(document.getElementById('root')!).render(<><AutoRootCtx /><App /></>)
