import { TodoExample } from './view'

export default function App() {
    return (
        <>
            
            <TodoExample listId="main" />
            <TodoExample listId="work" />
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
                Multiple independent todo lists showing how contexts can be scoped by parameters (listId).
                Each list maintains its own state.
            </p>
            
        </>
    )
}
