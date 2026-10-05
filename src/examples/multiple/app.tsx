import { useState } from 'react'
import { Board, Counter, Panel, Total } from './view'

const NAMES = ['A', 'B', 'C', 'D', 'E', 'F']

// Add a counter: its instance starts. Remove one: its instance stops, and comes back from 0.
export default function App() {
    const [ids, setIds] = useState(['A', 'B'])
    const add = () => setIds(list => [...list, NAMES.find(name => !list.includes(name))!])
    const remove = () => setIds(list => list.slice(0, -1))
    return (
        <>
            <Panel title="One instance per id">
                {ids.map(id => <Counter key={id} id={id} />)}
                <button onClick={add} disabled={ids.length === NAMES.length}>Add</button>
                <button onClick={remove} disabled={ids.length === 0}>Remove</button>
            </Panel>
            <Panel title="useMultipleStore: all of them in one call">
                <Board ids={ids} />
            </Panel>
            <Panel title="useMultipleStore with select">
                <Total ids={ids} />
            </Panel>
        </>
    )
}
