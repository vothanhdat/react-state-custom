import { useTodoStore } from './state'

export const TodoExample = ({ listId }: { listId: string }) => {
    const { todos, input, setInput, addTodo, toggleTodo, removeTodo, clearCompleted } =
        useTodoStore({ listId })

    return (
        <div className="card">
            <h3>Todo list <small>{listId}</small></h3>
            <div className="row">
                <input
                    className="grow"
                    value={input ?? ''}
                    onChange={e => setInput?.(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTodo?.()}
                    placeholder="Add todo..."
                />
                <button onClick={addTodo}>Add</button>
            </div>
            <ul className="list">
                {todos?.map(todo => (
                    <li key={todo.id}>
                        <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo?.(todo.id)} />
                        <span className={todo.completed ? 'grow done' : 'grow'}>{todo.text}</span>
                        <button onClick={() => removeTodo?.(todo.id)}>×</button>
                    </li>
                ))}
            </ul>
            {todos?.some(t => t.completed) && <button onClick={clearCompleted}>Clear completed</button>}
        </div>
    )
}

export default TodoExample
