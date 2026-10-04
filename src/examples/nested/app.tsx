import { Actions, Columns } from './view'

// The same player, read three ways. Every button replaces the whole player object, like a
// message from a socket. The tier changes only when the score reaches 10.
export default function App() {
    return (
        <>
            <Actions />
            <p>A cell flashes when it renders; each column counts its cells that rendered in the last update.</p>
            <Columns />
        </>
    )
}
