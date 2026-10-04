import { Actions, Columns, LastUpdate } from './view'

// The same player, read three ways. Every button replaces the whole player object, like a
// message from a socket. The tier changes only when the score reaches 10.
export default function App() {
    return (
        <>
            <Actions />
            <LastUpdate />
            <Columns />
        </>
    )
}
