import { TodoExample } from './view'

// listId is part of the store identity: each list is its own instance.
export default function App() {
    return (
        <>
            <TodoExample listId="main" />
            <TodoExample listId="work" />
        </>
    )
}
