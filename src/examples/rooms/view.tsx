import { useState } from 'react'
import { useRoom, useSocketLog } from './state'

// Three widgets, each calling useRoom({ roomId }) on its own: one connection per room for all of them.

export const UnreadBadge = ({ roomId }: { roomId: string }) => {
    const { unread } = useRoom({ roomId })
    return <span>#{roomId}{unread > 0 && <strong> ({unread})</strong>}</span>
}

export const ConnectionStatus = ({ roomId }: { roomId: string }) => {
    const { status } = useRoom({ roomId })
    return <small>{status === 'open' ? '🟢 connected' : '🟡 connecting…'}</small>
}

export const MessageList = ({ roomId }: { roomId: string }) => {
    const { messages, unread, markRead, send } = useRoom({ roomId })
    const [text, setText] = useState('')
    return (
        <>
            <ul className="list">
                {messages.slice(-5).map(m => <li key={m.id}><b>{m.author}</b> {m.text}</li>)}
            </ul>
            <form className="row" onSubmit={e => { e.preventDefault(); if (text) send(text); setText('') }}>
                <input className="grow" value={text} onChange={e => setText(e.target.value)} placeholder="Message" />
                <button type="submit">Send</button>
                <button type="button" onClick={markRead} disabled={unread === 0}>Mark read</button>
            </form>
        </>
    )
}

export const RoomPanel = ({ roomId, onClose }: { roomId: string, onClose: () => void }) => (
    <div className="card">
        <h3>
            <UnreadBadge roomId={roomId} /> <ConnectionStatus roomId={roomId} />
            <button style={{ float: 'right' }} onClick={onClose}>Close</button>
        </h3>
        <MessageList roomId={roomId} />
    </div>
)

export const SocketLog = () => {
    const { entries } = useSocketLog()
    return (
        <div className="card">
            <h3>Connections</h3>
            <pre className="log">{entries.join('\n') || 'Open a room.'}</pre>
        </div>
    )
}
