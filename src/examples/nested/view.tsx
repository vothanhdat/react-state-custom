import { useRef, useSyncExternalStore } from 'react'
import { usePlayerStore, usePlayerFields, tierOf, type Player } from './state'

type Field = 'name' | 'score' | 'tier' | 'city'
const FIELDS: Field[] = ['name', 'score', 'tier', 'city']
const valueOf = (player: Player, field: Field) => field === 'tier' ? tierOf(player.score) : player[field]

// Which cells rendered in the last update: a button starts an update, a cell marks itself
// when it renders, and the column headers read the marks once the update has settled.
let update = 0
let settled = 0
const marks = new Map<string, number>()
const listeners = new Set<() => void>()
const startUpdate = () => {
    update += 1
    setTimeout(() => { settled = update; listeners.forEach(l => l()) }, 50)
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

// A cell flashes each time it renders.
const Cell = ({ id, field, value }: { id: string, field: Field, value: string | number }) => {
    marks.set(id, update)
    const renders = useRef(0)
    renders.current += 1
    return <div key={renders.current} className="cell flash"><span>{field}</span><b>{value}</b></div>
}

// Reads the whole `player` key: every cell renders on every message.
const NestedCell = ({ field }: { field: Field }) => {
    const { player } = usePlayerStore()
    return <Cell id={`nested:${field}`} field={field} value={player ? valueOf(player, field) : ''} />
}

// A selector per cell: a cell renders when its value changes, and every selector runs on every message.
const SelectorCell = ({ field }: { field: Field }) => {
    const value = usePlayerStore(undefined, { select: s => s.player ? valueOf(s.player, field) : '' })
    return <Cell id={`selector:${field}`} field={field} value={value} />
}

// The flat store: each cell reads one top-level key.
const FlatCell = ({ field }: { field: Field }) => {
    const fields = usePlayerFields()
    return <Cell id={`flat:${field}`} field={field} value={fields[field] ?? ''} />
}

// How many cells of a column rendered in the last update. Its own component, so that showing
// the count re-renders no cell.
const Rendered = ({ mode }: { mode: string }) => {
    const last = useSyncExternalStore(subscribe, () => settled)
    const count = FIELDS.filter(field => marks.get(`${mode}:${field}`) === last).length
    return <small className="count" data-testid={`rendered-${mode}`}>{last ? `${count} of ${FIELDS.length} rendered` : '\u00a0'}</small>
}

const MODES = [
    { id: 'nested', title: 'player key', Cell: NestedCell },
    { id: 'selector', title: 'selectors', Cell: SelectorCell },
    { id: 'flat', title: 'flat store', Cell: FlatCell },
] as const

export const Columns = () => (
    <div className="columns">
        {MODES.map(({ id, title, Cell }) => (
            <div key={id} className="card">
                <h3>{title}</h3>
                {FIELDS.map(field => <Cell key={field} field={field} />)}
                <Rendered mode={id} />
            </div>
        ))}
    </div>
)

export const Actions = () => {
    const { addPoint, rename, move, resend } = usePlayerStore()
    // actions are undefined until the store has run once
    const run = (action?: () => void) => () => { if (action) { startUpdate(); action() } }
    return (
        <div className="row">
            <button onClick={run(addPoint)}>+1 score</button>
            <button onClick={run(rename)}>Rename</button>
            <button onClick={run(move)}>Move city</button>
            <button onClick={run(resend)}>Same values, new object</button>
        </div>
    )
}
