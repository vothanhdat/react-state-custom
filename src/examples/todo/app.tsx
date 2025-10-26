import { TodoExample } from './view'
import '../examples.css'

export default function App() {
    return (
        <>
            <TodoExample listId="main" />
            <TodoExample listId="work" />
            <p className="example-description">
                Multiple independent todo lists showing how contexts can be scoped by parameters (listId).
                Each list maintains its own state.
            </p>
        </>
    )
}
