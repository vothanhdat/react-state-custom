import { useState } from 'react'
import { RoomPanel, SocketLog, UnreadBadge } from './view'

const ROOMS = ['general', 'random', 'help']

// Open a room: its connection starts. Close it: the connection closes at once, while the messages
// stay for 30 s, so reopening it soon shows them right away.
export default function App() {
    const [open, setOpen] = useState<string[]>(['general'])
    const toggle = (roomId: string) =>
        setOpen(list => list.includes(roomId) ? list.filter(r => r !== roomId) : [...list, roomId])
    return (
        <>
            <div className="row">
                {/* a closed room's tab does not call useRoom: reading it would keep the connection open */}
                {ROOMS.map(roomId => (
                    <button key={roomId} onClick={() => toggle(roomId)} aria-pressed={open.includes(roomId)}>
                        {open.includes(roomId) ? <UnreadBadge roomId={roomId} /> : `#${roomId}`}
                    </button>
                ))}
            </div>
            {open.map(roomId => <RoomPanel key={roomId} roomId={roomId} onClose={() => toggle(roomId)} />)}
            <SocketLog />
        </>
    )
}
