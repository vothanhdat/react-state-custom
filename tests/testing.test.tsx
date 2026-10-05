// react-state-custom/testing: mockStore, resetStores, storeHandle, waitForStore.
// tests/setup.ts itself calls resetStores after each test.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, renderHook, act, screen, fireEvent } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { AutoRootCtx, createStore } from '../src'
import { mockStore, resetStores, storeHandle, waitForStore } from '../src/testing'

type Task = { id: string; title: string }

const fetchTasks = vi.fn((projectId: string) =>
  new Promise<Task[]>(resolve => setTimeout(() => resolve([{ id: `${projectId}-1`, title: `Real ${projectId}` }]), 5)))

// Exports only useStore, as most store modules do: the helpers reach the store through it.
const { useStore: useTasks } = createStore('testing-tasks', ({ projectId }: { projectId: string }) => {
  const [tasks, setTasks] = useState<Task[] | undefined>(undefined)
  useEffect(() => {
    let live = true
    fetchTasks(projectId).then(list => { if (live) setTasks(list) })
    return () => { live = false }
  }, [projectId])
  return { tasks, add: (task: Task) => setTasks(list => [...(list ?? []), task]) }
})

const TaskList = ({ projectId }: { projectId: string }) => {
  const { tasks, add } = useTasks({ projectId })
  if (!tasks) return <p>loading {projectId}</p>
  return <ul>
    {tasks.map(task => <li key={task.id}>{task.title}</li>)}
    <button onClick={() => add?.({ id: 'new', title: 'New' })}>add to {projectId}</button>
  </ul>
}

const App = () => <><AutoRootCtx /><TaskList projectId="p1" /></>

beforeEach(() => {
  fetchTasks.mockClear()
})
afterEach(() => { vi.restoreAllMocks() })

describe('mockStore', () => {
  it('runs in place of the store hook: readers see the mock, the hook never runs', () => {
    const add = vi.fn()
    mockStore(useTasks, { tasks: [{ id: 'a', title: 'Mocked' }], add })
    render(<App />)
    expect(screen.getByText('Mocked')).toBeTruthy()
    fireEvent.click(screen.getByText('add to p1'))
    expect(add).toHaveBeenCalledWith({ id: 'new', title: 'New' })
    expect(fetchTasks).not.toHaveBeenCalled()
  })

  it('set() merges values over the mock and re-renders the readers', () => {
    const mock = mockStore(useTasks, { tasks: [] })
    render(<App />)
    act(() => mock.set({ tasks: [{ id: 'b', title: 'Later' }] }))
    expect(screen.getByText('Later')).toBeTruthy()
  })

  it('takes a hook, which receives the params and may hold state', () => {
    mockStore(useTasks, ({ projectId }) => {
      const [tasks, setTasks] = useState<Task[]>([{ id: projectId, title: `Tasks of ${projectId}` }])
      return { tasks, add: (task: Task) => setTasks(list => [...list, task]) }
    })
    render(<><AutoRootCtx /><TaskList projectId="p1" /><TaskList projectId="p2" /></>)
    expect(screen.getByText('Tasks of p1')).toBeTruthy()
    expect(screen.getByText('Tasks of p2')).toBeTruthy()
    fireEvent.click(screen.getByText('add to p1'))
    expect(screen.getAllByText('New')).toHaveLength(1)
  })

  it('fails the store when the mock throws, as its own hook would', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    mockStore(useTasks, () => { throw new Error('offline') })
    render(<AutoRootCtx />)
    const tasks = storeHandle(useTasks, { projectId: 'p1' })
    let release = () => { }
    act(() => { release = tasks.retain() })
    await expect(waitForStore(useTasks, { projectId: 'p1' })).rejects.toThrow('offline')
    expect(tasks.error).toEqual(new Error('offline'))
    act(() => release())
  })

  it('applies to instances that start after it: restore() brings back the store hook for the next ones', async () => {
    const mock = mockStore(useTasks, { tasks: [{ id: 'm', title: 'Mocked' }] })
    const first = render(<App />)
    expect(screen.getByText('Mocked')).toBeTruthy()
    mock.restore()
    first.unmount()
    render(<App />)
    expect(await screen.findByText('Real p1')).toBeTruthy()
    expect(fetchTasks).toHaveBeenCalled()
  })

  it('warns when the store is already running, which keeps its own hook', () => {
    render(<App />)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { })
    mockStore(useTasks, { tasks: [] })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('testing-tasks?projectId=p1 already running'))
    expect(screen.getByText('loading p1')).toBeTruthy()
  })

  it('serves a hook under test that reads the store, through renderHook', () => {
    const { useStore: useSession } = createStore('testing-session', () => ({ user: undefined as { name: string } | undefined }))
    const useGreeting = () => {
      const { user } = useSession()
      return user ? `Hello ${user.name}` : 'Hello'
    }
    mockStore(useSession, { user: { name: 'Dat' } })
    const { result } = renderHook(useGreeting, { wrapper: ({ children }) => <><AutoRootCtx />{children}</> })
    expect(result.current).toBe('Hello Dat')
  })

  it('takes only a function that createStore returned', () => {
    expect(() => mockStore((() => null) as any, {})).toThrow(/takes a function returned by createStore/)
  })
})

describe('resetStores', () => {
  it('removes the mocks', async () => {
    mockStore(useTasks, { tasks: [] })
    resetStores()
    render(<App />)
    expect(await screen.findByText('Real p1')).toBeTruthy()
  })

  it('drops the contexts with their state, also one that something still holds', () => {
    const { useStore: useCount } = createStore('testing-count', () => {
      const [n, setN] = useState(0)
      return { n, setN }
    })
    const View = () => <span>n={useCount().n}</span>
    const r = render(<><AutoRootCtx /><View /></>)
    const count = storeHandle(useCount)
    const forgotten = count.subscribe(() => { })   // a test that never unsubscribes
    act(() => count.get().setN!(5))
    r.unmount()
    expect(count.get().n).toBe(5)                   // held by the subscription
    resetStores()
    expect(count.get().n).toBeUndefined()
    forgotten()
  })
})

describe('storeHandle', () => {
  it('reads and drives a store whose module exports only useStore', async () => {
    render(<App />)
    const tasks = storeHandle(useTasks, { projectId: 'p1' })
    await waitForStore(useTasks, { projectId: 'p1' }, ['tasks'])
    expect(tasks.ready).toBe(true)
    act(() => tasks.get().add!({ id: 'x', title: 'From the test' }))
    expect(screen.getByText('From the test')).toBeTruthy()
  })
})

describe('waitForStore', () => {
  it('resolves once the keys hold values, after the readers re-rendered, without act warnings', async () => {
    const error = vi.spyOn(console, 'error')
    render(<App />)
    expect(screen.getByText('loading p1')).toBeTruthy()
    const { tasks } = await waitForStore(useTasks, { projectId: 'p1' }, ['tasks'])
    expect(tasks.map(task => task.title)).toEqual(['Real p1'])
    expect(screen.getByText('Real p1')).toBeTruthy()
    expect(error).not.toHaveBeenCalled()
    expect((globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT).toBe(true)
  })

  it('waits for the first publish, or for a predicate', async () => {
    render(<App />)
    const first = await waitForStore(useTasks, { projectId: 'p1' })
    expect(first.add).toBeTypeOf('function')
    const loaded = await waitForStore(useTasks, { projectId: 'p1' }, state => (state.tasks?.length ?? 0) > 0)
    expect(loaded.tasks).toHaveLength(1)
    // already true: resolves at once
    await waitForStore(useTasks, { projectId: 'p1' }, ['tasks'])
  })

  it('keeps the act environment off until the last of several waits ends', async () => {
    render(<><AutoRootCtx /><TaskList projectId="p1" /><TaskList projectId="p2" /></>)
    await Promise.all([
      waitForStore(useTasks, { projectId: 'p1' }, ['tasks']),
      waitForStore(useTasks, { projectId: 'p2' }, ['tasks']),
    ])
    expect((globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT).toBe(true)
  })

  it('rejects after the timeout, saying why', async () => {
    await expect(waitForStore(useTasks, { projectId: 'none' }, undefined, { timeout: 20 }))
      .rejects.toThrow('waitForStore("testing-tasks?projectId=none") timed out after 20 ms: no instance of it is running')
    const app = render(<App />)
    await expect(waitForStore(useTasks, { projectId: 'p1' }, state => state.tasks?.length === 3, { timeout: 50 }))
      .rejects.toThrow('isReady still returns false')
    app.unmount()
    mockStore(useTasks, {})
    render(<><AutoRootCtx /><TaskList projectId="p3" /></>)
    await expect(waitForStore(useTasks, { projectId: 'p3' }, ['tasks', 'add'], { timeout: 20 }))
      .rejects.toThrow('still undefined: tasks, add')
  })
})
