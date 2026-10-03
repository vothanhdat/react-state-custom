// The lifecycle recipes of the guide, as written there: Store options ("Keeping the values, not the
// resource") and Outside React ("Keep a task running after its screen closes").
import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { createStore, AutoRootCtx } from '../src/state-utils/createAutoCtx'

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
