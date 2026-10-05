// The recipes of the guide, as written there: Store options ("Keeping the values, not the resource"),
// Outside React ("Keep a task running after its screen closes"), Composing stores ("Flatten a
// nested source") and Selectors ("Rendering a list", "Items with their own fetch or subscription").
import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'
import { shallowEqual } from '../src/state-utils/utils'

const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

describe('keeping the values, not the resource', () => {
  it('closes the socket with the last screen and shows the kept messages when one comes back', async () => {
    const socket = { open: 0, send: (_: string) => { } }
    const { useStore: useRoomHistory } = createStore('recipe-room-history', ({ roomId: _ }: { roomId: string }) => {
      const [messages, setMessages] = useState<string[]>([])
      return { messages, setMessages }
    }, { initialState: { messages: [] }, timeToClean: 5 * 60_000 })
    const { useStore: useRoom } = createStore('recipe-room', ({ roomId }: { roomId: string }) => {
      const { messages, setMessages } = useRoomHistory({ roomId })
      useEffect(() => {
        if (!setMessages) return
        socket.open++
        socket.send = message => setMessages(list => [...list, message])
        return () => { socket.open-- }
      }, [roomId, setMessages])
      return { messages }
    })

    const Screen = () => <b data-testid="m">{(useRoom({ roomId: 'r1' }).messages ?? []).join(',')}</b>
    const { rerender, getByTestId } = render(<><AutoRootCtx /><Screen /></>)
    await tick()
    act(() => { socket.send('hi'); socket.send('yo') })
    await tick()

    rerender(<><AutoRootCtx /></>)
    await tick(500)
    expect(socket.open).toBe(0)

    rerender(<><AutoRootCtx /><Screen /></>)
    await tick()
    expect(getByTestId('m').textContent).toBe('hi,yo')
    expect(socket.open).toBe(1)
  })
})

describe('keep a task running after its screen closes', () => {
  it('retains itself while uploading and lets go once done', async () => {
    let alive = 0
    let complete = () => { }
    const { useStore: useUpload, getStore: getUpload } = createStore('recipe-upload', ({ id }: { id: string }) => {
      const [status, setStatus] = useState<'idle' | 'uploading' | 'done'>('idle')
      useEffect(() => { alive++; return () => { alive-- } }, [])
      useEffect(() => {
        if (status !== 'uploading') return
        return getUpload({ id }).retain()
      }, [status, id])
      complete = () => setStatus('done')
      return { status, start: () => setStatus('uploading') }
    })

    const Screen = () => {
      const { status, start } = useUpload({ id: 'u1' })
      return <button data-testid="b" onClick={start}>{status}</button>
    }
    const { rerender, getByTestId } = render(<><AutoRootCtx /><Screen /></>)
    await tick()
    act(() => getByTestId('b').click())
    await tick()

    rerender(<><AutoRootCtx /></>) // the screen closes mid-upload
    await tick(200)
    expect(alive).toBe(1)

    rerender(<><AutoRootCtx /><Screen /></>) // another screen shows the same upload
    await tick()
    expect(getByTestId('b').textContent).toBe('uploading')
    rerender(<><AutoRootCtx /></>)
    await tick()

    act(() => complete())
    await tick(200)
    expect(alive).toBe(0)
  })
})

describe('flatten a nested source', () => {
  it('re-renders a reader of one field only when that field changes', async () => {
    type Player = { name: string, score: number, address: { city: string } }
    const emptyPlayer: Player = { name: '', score: 0, address: { city: '' } }
    let send = (_: Player) => { }
    const subscribePlayer = (_id: string, onMessage: (p: Player) => void) => { send = onMessage; return () => { send = () => { } } }

    const { useStore: usePlayerStore } = createStore('recipe-player', ({ id }: { id: string }) => {
      const [player, setPlayer] = useState(emptyPlayer)
      useEffect(() => subscribePlayer(id, setPlayer), [id])
      return { player }
    }, { initialState: { player: emptyPlayer } })
    const { useStore: usePlayerFields } = createStore('recipe-player-fields', ({ id }: { id: string }) => {
      const { player } = usePlayerStore({ id })
      return { ...player }
    }, { initialState: emptyPlayer })

    let renders = 0
    const Score = ({ id }: { id: string }) => {
      const { score } = usePlayerFields({ id })
      renders++
      return <b data-testid="s">{score}</b>
    }
    const { getByTestId } = render(<><AutoRootCtx /><Score id="p1" /></>)
    await tick()
    const address = { city: 'Hanoi' }
    act(() => send({ name: 'An', score: 1, address }))
    await tick()
    expect(getByTestId('s').textContent).toBe('1')

    const before = renders
    act(() => send({ name: 'Binh', score: 1, address })) // a new object, same score
    await tick()
    expect(renders).toBe(before)

    act(() => send({ name: 'Binh', score: 2, address }))
    await tick()
    expect(getByTestId('s').textContent).toBe('2')
  })
})

describe('rendering a list', () => {
  type Task = { title: string; status: string }
  const setup = (name: string) => {
    const { useStore: useTasks, getStore: getTasks } = createStore(`${name}-tasks`, ({ projectId: _ }: { projectId: string }) => {
      const [tasks, setTasks] = useState<Record<string, Task>>({ a: { title: 'A', status: 'todo' }, b: { title: 'B', status: 'todo' }, c: { title: 'C', status: 'todo' } })
      const setStatus = (id: string, status: string) => setTasks(t => ({ ...t, [id]: { ...t[id]!, status } }))
      const remove = (id: string) => setTasks(t => { const { [id]: _, ...rest } = t; return rest })
      return { tasks, setStatus, remove }
    })
    // derived one commit later, with a new array whenever any task changes
    const { useStore: useVisible } = createStore(`${name}-visible`, ({ projectId }: { projectId: string }) => {
      const { tasks } = useTasks({ projectId })
      const ids = useMemo(() => Object.keys(tasks ?? {}).sort(), [tasks])
      return { ids }
    })
    const renders: Record<string, number> = { list: 0 }
    const TaskRow = memo(({ projectId, id }: { projectId: string; id: string }) => {
      renders[id] = (renders[id] ?? 0) + 1
      const task = useTasks({ projectId }, s => s.tasks?.[id])
      if (!task) return null                 // deleted while the list still had its id
      return <li>{task.title} {task.status}</li>
    })
    const TaskList = ({ projectId }: { projectId: string }) => {
      renders.list++
      const ids = useVisible({ projectId }, s => s.ids ?? [], shallowEqual)
      return <ul>{ids.map(id => <TaskRow key={id} projectId={projectId} id={id} />)}</ul>
    }
    return { getTasks, renders, TaskList }
  }

  it('re-renders only the changed row, and not the list', async () => {
    const { getTasks, renders, TaskList } = setup('recipe-rows')
    const { container } = render(<><AutoRootCtx /><TaskList projectId="p" /></>)
    await tick()
    expect(container.querySelectorAll('li')).toHaveLength(3)
    const before = { ...renders }
    await act(async () => { getTasks({ projectId: 'p' }).get().setStatus!('b', 'done') })
    expect(container.textContent).toContain('B done')
    expect(renders.b).toBeGreaterThan(before.b!)
    expect([renders.a, renders.c, renders.list]).toEqual([before.a, before.c, before.list])
  })

  it('drops a deleted row without crashing', async () => {
    const { getTasks, TaskList } = setup('recipe-rows-delete')
    const { container } = render(<><AutoRootCtx /><TaskList projectId="p" /></>)
    await tick()
    await act(async () => { getTasks({ projectId: 'p' }).get().remove!('b') })
    expect([...container.querySelectorAll('li')].map(li => li.textContent)).toEqual(['A todo', 'C todo'])
  })
})

describe('items with their own fetch or subscription: one collection store', () => {
  it('loads an id once for all its readers and drops it after the grace period', async () => {
    const GRACE = 50                         // 5 s in the guide
    type Detail = { comments: string[] }
    type Entry = { readers: number; drop?: ReturnType<typeof setTimeout>; stop: () => void }
    const calls = { fetch: 0, open: 0 }
    const api = { fetchDetail: async (id: string): Promise<Detail> => { calls.fetch++; return { comments: [`on ${id}`] } } }
    const socket = { watchTask: (_id: string, _fn: (d: Detail) => void) => { calls.open++; return () => { calls.open-- } } }

    const { useStore: useTaskDetails } = createStore('recipe-task-details', () => {
      const [details, setDetails] = useState<Record<string, Detail | undefined>>({})
      const [status, setStatus] = useState<Record<string, 'loading' | 'loaded' | 'error' | undefined>>({})
      const entries = useRef(new Map<string, Entry>())

      const start = (id: string): Entry => {
        setStatus(s => ({ ...s, [id]: 'loading' }))
        api.fetchDetail(id).then(
          d => { setDetails(s => ({ ...s, [id]: d })); setStatus(s => ({ ...s, [id]: 'loaded' })) },
          () => setStatus(s => ({ ...s, [id]: 'error' })),
        )
        const entry: Entry = { readers: 0, stop: socket.watchTask(id, d => setDetails(s => ({ ...s, [id]: d }))) }
        entries.current.set(id, entry)
        return entry
      }

      const subscribe = (id: string) => {
        const entry = entries.current.get(id) ?? start(id)
        clearTimeout(entry.drop)
        entry.readers++
        return () => {
          if (--entry.readers > 0) return
          entry.drop = setTimeout(() => { entry.stop(); entries.current.delete(id) }, GRACE)
        }
      }

      useEffect(() => () => {
        entries.current.forEach((entry, id) => {
          if (entry.readers > 0) return
          clearTimeout(entry.drop)
          entry.stop()
          entries.current.delete(id)
        })
      }, [])

      return { details, status, subscribe }
    }, { timeToClean: 10 * GRACE })        // outlives its last reader, so the grace period can run

    const useTaskDetail = (id: string) => {
      const { subscribe } = useTaskDetails()
      useEffect(() => subscribe?.(id), [subscribe, id])
      const detail = useTaskDetails(undefined, s => s.details?.[id])
      const status = useTaskDetails(undefined, s => s.status?.[id])
      return { detail, status }
    }

    const Reader = ({ id }: { id: string }) => {
      const { detail, status } = useTaskDetail(id)
      return <i>{status ?? 'idle'}:{detail?.comments.join() ?? '…'}</i>
    }
    const { container, rerender } = render(<><AutoRootCtx /><Reader id="x" /><Reader id="x" /></>)
    await tick()
    expect(container.textContent).toBe('loaded:on xloaded:on x')
    expect(calls).toEqual({ fetch: 1, open: 1 })

    // every reader leaves, one comes back within the grace period: nothing is fetched again
    rerender(<><AutoRootCtx /></>)
    await tick(10)
    rerender(<><AutoRootCtx /><Reader id="x" /></>)
    await tick(GRACE + 20)
    expect(container.textContent).toBe('loaded:on x')
    expect(calls).toEqual({ fetch: 1, open: 1 })

    // gone for longer than the grace period: the socket closes
    rerender(<><AutoRootCtx /></>)
    await tick(GRACE + 20)
    expect(calls.open).toBe(0)
  })
})
