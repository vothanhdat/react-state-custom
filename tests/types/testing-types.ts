// Type-level tests of react-state-custom/testing, checked by `yarn typecheck` (tsc), never run.
import { useState } from 'react'
import { createStore } from '../../src'
import { mockStore, storeHandle, waitForStore } from '../../src/testing'

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
const assert = <T extends true>() => { }

type Task = { id: string; title: string }
type Status = 'loading' | 'done'

const tasks = createStore('types-testing-tasks', ({ projectId }: { projectId: string }) => {
  const [list, setList] = useState<Task[] | undefined>(undefined)
  const [status, setStatus] = useState<Status>('loading')
  void projectId
  return { list, status, add: (task: Task) => { setList(l => [...(l ?? []), task]); setStatus('done') } }
}, { initialState: { status: 'loading' } })

const session = createStore('types-testing-session', () => ({ user: 'dat' as string | null, login: (_name: string) => { } }))

export const mocks = () => {
  // from useStore, getStore or useStoreSuspense: some keys are enough
  mockStore(tasks.useStore, { status: 'done' })
  mockStore(tasks.getStore, { list: [{ id: 'a', title: 'A' }], add: () => { } })
  mockStore(tasks.useStoreSuspense, { status: 'done' })
  // @ts-expect-error a value the hook never returns
  mockStore(tasks.useStore, { status: 'idle' })
  // @ts-expect-error a key the store does not have
  mockStore(tasks.useStore, { lists: [] })
  // @ts-expect-error an action with the wrong signature
  mockStore(tasks.useStore, { add: (_id: number) => { } })
  // @ts-expect-error checked from getStore too
  mockStore(tasks.getStore, { status: 'idle' })
  // @ts-expect-error and from useStoreSuspense
  mockStore(tasks.useStoreSuspense, { lists: [] })

  // a hook receives the store's params
  mockStore(tasks.useStore, ({ projectId }) => {
    assert<Equals<typeof projectId, string>>()
    const [list] = useState<Task[]>([])
    return { list, status: 'done' }
  })
  // @ts-expect-error the hook must return the store's types
  mockStore(tasks.useStore, () => ({ status: 1 }))

  const mock = mockStore(session.useStore, { user: null })
  mock.set({ user: 'other' })
  // @ts-expect-error set takes the store's types
  mock.set({ user: 1 })
  mock.restore()
}

export const handles = async () => {
  const handle = storeHandle(tasks.useStore, { projectId: 'p1' })
  assert<Equals<typeof handle, ReturnType<typeof tasks.getStore>>>()
  // initialState keeps `status` present
  assert<Equals<ReturnType<typeof handle.get>['status'], Status>>()
  // @ts-expect-error params are required
  storeHandle(tasks.useStore)
  storeHandle(session.useStore)

  // waiting for the first publish: as useStore
  const ready = await waitForStore(tasks.useStore, { projectId: 'p1' })
  assert<Equals<typeof ready.list, Task[] | undefined>>()
  assert<Equals<typeof ready.status, Status>>()

  // waiting for keys types them as present
  const loaded = await waitForStore(tasks.useStore, { projectId: 'p1' }, ['list', 'add'])
  assert<Equals<typeof loaded.list, Task[]>>()
  assert<Equals<typeof loaded.add, (task: Task) => void>>()
  // @ts-expect-error a key the store does not have
  await waitForStore(tasks.useStore, { projectId: 'p1' }, ['lists'])

  // a predicate, with options
  const done = await waitForStore(tasks.getStore, { projectId: 'p1' }, s => s.status === 'done', { timeout: 50 })
  assert<Equals<typeof done.list, Task[] | undefined>>()

  // no params: omitted, or undefined before more arguments
  await waitForStore(session.useStore)
  const user = await waitForStore(session.useStore, undefined, ['user'])
  assert<Equals<typeof user.user, string | null>>()
  // @ts-expect-error params are required
  await waitForStore(tasks.useStore)
}
