import { useQuickSubscribe } from '../../index'
import { useTodoCtx } from './state'

export const TodoExample = ({ listId = "main" }: { listId?: string }) => {
    const { todos, input, setInput, addTodo, toggleTodo, removeTodo, clearCompleted } =
        useQuickSubscribe(useTodoCtx({ listId }))

    return (
        <div style={{ padding: '1rem', border: '1px solid #ccc', marginBottom: '1rem' }}>
            <h3>Todo List ({listId})</h3>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                    value={input ?? ''}
                    onChange={(e) => setInput?.(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTodo?.()}
                    placeholder="Add todo..."
                    style={{ flex: 1, padding: '0.25rem' }}
                />
                <button onClick={addTodo}>Add</button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {todos?.map(todo => (
                    <li key={todo.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={() => toggleTodo?.(todo.id)}
                        />
                        <span style={{
                            flex: 1,
                            textDecoration: todo.completed ? 'line-through' : 'none',
                            opacity: todo.completed ? 0.6 : 1
                        }}>
                            {todo.text}
                        </span>
                        <button onClick={() => removeTodo?.(todo.id)}>×</button>
                    </li>
                ))}
            </ul>
            {todos?.some(t => t.completed) && (
                <button onClick={clearCompleted}>Clear Completed</button>
            )}
        </div>
    )
}

export default TodoExample
