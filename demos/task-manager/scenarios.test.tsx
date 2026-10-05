import React, { Profiler, useState } from 'react'
import { render, act, cleanup, configure } from '@testing-library/react'
import { AutoRootCtx } from '../../src'
import { resetStores, storeHandle } from '../../src/testing'
import * as A from './app'

configure({ reactStrictMode: false })
const flush = (ms = 20) => act(() => new Promise(r => setTimeout(r, ms)))
const log = (...a: unknown[]) => console.log('[dx]', ...a)
let commits = 0
const onRender = () => { commits++ }
const reset = () => { for (const k in A.renders) delete A.renders[k]; commits = 0 }

const seed = (projectId: string, n: number) => {
  for (let i = 0; i < n; i++) {
    const id = `${projectId}-t${String(i).padStart(2, '0')}`
    A.db[id] = { id, title: 'task ' + String(i).padStart(2, '0'), status: 'todo', projectId, updatedAt: i }
  }
}

const Page = ({ projectId }: { projectId: string }) => <>
  <A.Toolbar projectId={projectId} />
  <A.Stats projectId={projectId} />
  <A.TaskList projectId={projectId} />
</>

beforeEach(() => { A.zombies.length = 0; A.step.name = ''; for (const k in A.db) delete A.db[k]; A.calls.length = 0; reset() })
afterEach(() => { cleanup(); resetStores() })

it('A. load, one update, one delete', async () => {
  seed('p1', 50)
  let setErr: unknown
  const { container } = render(<Profiler id="app" onRender={onRender}><AutoRootCtx /><Page projectId="p1" /></Profiler>)
  await flush()
  log('A load: rows', container.querySelectorAll('li').length, '| commits', commits, '| list renders', A.renders.list, '| calls', A.calls.join(' '))

  // B. edit one task (optimistic, then the saved copy with a new updatedAt)
  reset()
  await act(async () => { A.tasksRef({ projectId: 'p1' }).get().updateTask!('p1-t10', { status: 'doing' }) })
  const rowsOptimistic = Object.keys(A.renders).filter(k => k.startsWith('row:')).length
  const commitsOptimistic = commits
  await flush()
  log('B update one task: optimistic → rows rendered', rowsOptimistic, 'commits', commitsOptimistic,
    '| after save → rows rendered (total)', Object.keys(A.renders).filter(k => k.startsWith('row:')).length,
    'list', A.renders.list, 'stats', A.renders.stats, 'toolbar', A.renders.toolbar, 'commits', commits)

  // C. delete a task: the row reads tasks[id] from `tasks`, the list reads ids from `visible`, one commit later
  reset()
  const errors: string[] = []
  const origError = console.error
  console.error = (...a: unknown[]) => { errors.push(String(a[0]).slice(0, 120)) }
  try {
    await act(async () => { A.tasksRef({ projectId: 'p1' }).get().deleteTask!('p1-t20') })
    await flush()
  } catch (e) { setErr = e } finally { console.error = origError }
  log('C zombies', A.zombies.splice(0))
  log('C delete: thrown =', setErr ? String(setErr).slice(0, 100) : 'none', '| console.error:', errors.slice(0, 2))
})

it('C2. delete with a guarded row', async () => {
  seed('p1', 5)
  const Row = ({ id }: { id: string }) => {
    const task = A.useTasks({ projectId: 'p1' }, { select: s => s.tasks[id] })
    A.renders['zombie:' + id] = (A.renders['zombie:' + id] ?? 0) + (task ? 0 : 1)
    return task ? <li>{task.title}</li> : null
  }
  const List = () => <ul>{A.useVisible({ projectId: 'p1' }).ids.map(id => <Row key={id} id={id} />)}</ul>
  render(<><AutoRootCtx /><List /></>)
  await flush()
  await act(async () => { A.tasksRef({ projectId: 'p1' }).get().deleteTask!('p1-t02') })
  await flush()
  log('C2 renders of a deleted row with task undefined:', A.renders['zombie:p1-t02'] ?? 0)
})

it('D. failed update rolls back; E. undo; F. one socket for five readers', async () => {
  seed('p1', 3)
  const { container, rerender } = render(<><AutoRootCtx /><Page projectId="p1" /></>)
  await flush()
  A.control.failNextUpdate = true
  await act(async () => { A.tasksRef({ projectId: 'p1' }).get().updateTask!('p1-t01', { title: 'renamed' }) })
  const optimistic = container.textContent!.includes('renamed')
  await flush()
  log('D failed update: optimistic shown', optimistic, '→ rolled back', !container.textContent!.includes('renamed'), '| error', A.tasksRef({ projectId: 'p1' }).get().error)

  await act(async () => { A.tasksRef({ projectId: 'p1' }).get().deleteTask!('p1-t00') })
  await flush()
  const before = container.querySelectorAll('li').length
  await act(async () => { (container.querySelectorAll('button')[2] as HTMLButtonElement).click() })
  log('E undo after delete: rows', before, '→', container.querySelectorAll('li').length)

  await act(async () => { A.socket.emit({ ...A.db['p1-t02'], title: 'from socket', updatedAt: 999 }) })
  log('F socket: subscriptions', A.calls.filter(c => c.startsWith('socket+')).length, '| socket update shown', container.textContent!.includes('from socket'))

  rerender(<><AutoRootCtx /><Page projectId="p2" /></>)
  await flush()
  log('F leave p1: calls', A.calls.filter(c => c.startsWith('socket')).join(' '))
})

it('G. filters survive a round trip, tasks refetch; I. draft survives closing the editor', async () => {
  seed('p1', 4); seed('p2', 2)
  A.db['p1-t01'].status = 'done'
  const Nav = () => {
    const [p, setP] = useState('p1')
    const [editing, setEditing] = useState(true)
    ;(globalThis as any).go = setP; (globalThis as any).edit = setEditing
    return <>{<Page projectId={p} />}{editing && p === 'p1' && <A.Editor projectId="p1" taskId="p1-t03" />}</>
  }
  const { container } = render(<><AutoRootCtx /><Nav /></>)
  await flush()
  await act(async () => { (container.querySelectorAll('button')[0] as HTMLButtonElement).click() }) // status = done
  await flush()
  const rowsFiltered = container.querySelectorAll('li').length
  const input = container.querySelector('input')!
  await act(async () => { input.value = ''; })
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => { setter.call(input, 'draft title'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  await act(async () => { (globalThis as any).edit(false) })
  A.step.name = 'G to p2'
  await act(async () => { (globalThis as any).go('p2') })
  await flush()
  A.step.name = 'G back to p1'
  await act(async () => { (globalThis as any).go('p1'); (globalThis as any).edit(true) })
  await flush()
  log('G zombies', A.zombies.splice(0))
  log('G filter kept: rows', rowsFiltered, '→', container.querySelectorAll('li').length,
    '| lists fetched', A.calls.filter(c => c.startsWith('list')).join(' '))
  log('I draft after reopening:', JSON.stringify(container.querySelector('input')?.value))
})

it('H. search: the slow early response does not overwrite the later one', async () => {
  seed('p1', 5)
  const Search = () => { const { query, results } = A.useSearch({ projectId: 'p1' }); return <p>{query}:{results.join(',')}</p> }
  const { container } = render(<><AutoRootCtx /><Search /></>)
  await flush()
  A.control.searchDelays = [40, 5]
  const search = storeHandle(A.useSearch, { projectId: 'p1' })
  await act(async () => { search.get().setQuery?.('task') })
  await act(async () => { search.get().setQuery?.('task 03') })
  await flush(80)
  log('H search after typing "task" then "task 03":', container.textContent)
})

it('J. login recomputes the derived list; K. a click before the store ran', async () => {
  seed('p1', 3)
  A.db['p1-t00'].assignee = 'u-dat'
  const Mine = () => {
    const { setMine } = A.useFilters({ projectId: 'p1' })
    const { ids } = A.useVisible({ projectId: 'p1' })
    const { login } = A.useSession()
    ;((globalThis as any).firstRender ??= []).push(typeof setMine)
    return <p>{ids.join(',')}<button onClick={() => login?.('dat')}>login</button></p>
  }
  const { container } = render(<><AutoRootCtx /><Mine /></>)
  await flush()
  log('K typeof setMine per render:', (globalThis as any).firstRender.join(' '))
  await act(async () => { A.sessionRef().get().login!('dat') })
  log('J login → visible', container.querySelector('p')!.firstChild?.textContent)
})
