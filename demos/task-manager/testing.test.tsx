// Component tests of the demo with react-state-custom/testing: mocked stores instead of the fake
// api and socket, a real derived store on top of a mocked one, and waiting for the real tasks store.
import { render, act, fireEvent, screen } from '@testing-library/react'
import { AutoRootCtx } from '../../src'
import { mockStore, resetStores, storeHandle, waitForStore } from '../../src/testing'
import * as A from './app'

const task = (id: string, status: A.Status, title = id): A.Task => ({ id, title, status, projectId: 'p1', updatedAt: 0 })

beforeEach(() => { for (const k in A.db) delete A.db[k]; A.calls.length = 0 })
afterEach(() => { resetStores() })

it('renders the list from mocked stores, without the api', () => {
  mockStore(A.useTasks, { tasks: { a: task('a', 'todo', 'Write docs') } })
  mockStore(A.useVisible, { ids: ['a', 'gone'] })   // an id whose task is missing: its row renders nothing
  const { container } = render(<><AutoRootCtx /><A.TaskList projectId="p1" /></>)
  expect(container.querySelectorAll('li')).toHaveLength(1)
  expect(screen.getByText('Write docs [todo]')).toBeTruthy()
  expect(A.calls).toEqual([])
})

it('calls the mocked action, and follows the mock as it changes', () => {
  const undo = vi.fn()
  const tasks = mockStore(A.useTasks, { canUndo: false, undo })
  render(<><AutoRootCtx /><A.Toolbar projectId="p1" /></>)
  const button = screen.getByText('undo') as HTMLButtonElement
  expect(button.disabled).toBe(true)
  act(() => tasks.set({ canUndo: true }))
  expect(button.disabled).toBe(false)
  fireEvent.click(button)
  expect(undo).toHaveBeenCalledTimes(1)
})

it('runs a real derived store on top of a mocked one', () => {
  mockStore(A.useTasks, { tasks: { a: task('a', 'todo'), b: task('b', 'done'), c: task('c', 'done') } })
  render(<><AutoRootCtx /><A.Stats projectId="p1" /></>)
  expect(screen.getByText('1/0/2')).toBeTruthy()
})

it('waits for the real tasks store, and drives the search store from the test', async () => {
  A.db.a = task('a', 'todo', 'task a')
  render(<><AutoRootCtx /><A.TaskList projectId="p1" /></>)
  const { tasks } = await waitForStore(A.useTasks, { projectId: 'p1' }, state => state.status === 'ready')
  expect(Object.keys(tasks)).toEqual(['a'])
  expect(screen.getByText('task a [todo]')).toBeTruthy()

  // useSearch is exported without storeRef
  const Search = () => <p>{(A.useSearch({ projectId: 'p1' }).results ?? A.NO_IDS).join(',')}</p>
  render(<><AutoRootCtx /><Search /></>)
  const search = storeHandle(A.useSearch, { projectId: 'p1' })
  act(() => search.get().setQuery?.('task'))
  await waitForStore(A.useSearch, { projectId: 'p1' }, state => state.results.length > 0)
  expect(screen.getByText('a')).toBeTruthy()
})
