import { createStore } from '../../index'
import { useEffect, useState } from 'react'

export type Message = { id: number, author: string, text: string }

// A pretend chat server: one connection per room, a message every couple of seconds.
let nextId = 1
const people = ['Ada', 'Linus', 'Grace', 'Alan']
const lines = ['hi all', 'anyone around?', 'shipping it', 'looks good to me', 'brb', 'nice']
const connect = (roomId: string, onOpen: () => void, onMessage: (message: Message) => void) => {
    const opening = setTimeout(onOpen, 300)
    const feed = setInterval(() => onMessage({
        id: nextId++,
        author: people[Math.floor(Math.random() * people.length)],
        text: `${lines[Math.floor(Math.random() * lines.length)]} (#${roomId})`,
    }), 2000)
    return () => { clearTimeout(opening); clearInterval(feed) }
}

// Every connection opened and closed, so the lifecycle is visible.
const useSocketLogState = () => {
    const [entries, setEntries] = useState<string[]>([])
    const add = (entry: string) => setEntries(list => [`${new Date().toLocaleTimeString()}  ${entry}`, ...list].slice(0, 8))
    return { entries, add }
}
export const { useStore: useSocketLog } = createStore('socket-log', useSocketLogState, {
    initialState: { entries: [] },
})

// The values of a room: no effects, kept 30 s after the room closes.
const useRoomHistoryState = ({ roomId: _ }: { roomId: string }) => {
    const [messages, setMessages] = useState<Message[]>([])
    const [read, setRead] = useState(0)
    return { messages, setMessages, unread: messages.length - read, markRead: () => setRead(messages.length) }
}
export const { useStore: useRoomHistory } = createStore('room-history', useRoomHistoryState, {
    initialState: { messages: [], unread: 0 },
    timeToClean: 30_000,
})

// The connection of a room: one per roomId, however many widgets show it, closed as soon as the
// last of them leaves. It writes into the history, which outlives it.
const useRoomState = ({ roomId }: { roomId: string }) => {
    const { messages, setMessages, unread, markRead } = useRoomHistory({ roomId })
    const { add } = useSocketLog()
    const [status, setStatus] = useState<'connecting' | 'open'>('connecting')

    useEffect(() => {
        if (!setMessages || !add) return
        add(`#${roomId} connecting`)
        const close = connect(
            roomId,
            () => { setStatus('open'); add(`#${roomId} open`) },
            message => setMessages(list => [...list, message]),
        )
        return () => { close(); add(`#${roomId} closed`) }
    }, [roomId, setMessages, add])

    const send = (text: string) => setMessages?.(list => [...list, { id: nextId++, author: 'You', text }])
    return { status, messages, unread, markRead, send }
}
export const { useStore: useRoom } = createStore('room', useRoomState, {
    initialState: { status: 'connecting', messages: [], unread: 0 },
})
