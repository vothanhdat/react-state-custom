import { useQuickSubscribe } from '../../index'
import { useTodoCtx } from './state'
import '../examples.css'

export const TodoExample = ({ listId = "main" }: { listId?: string }) => {
    const { todos, input, setInput, addTodo, toggleTodo, removeTodo, clearCompleted } =
        useQuickSubscribe(useTodoCtx({ listId }))

    return (
        <article className="example-container">
            <h3>Todo List ({listId})</h3>
            <div className="todo-input-group">
                <input
                    value={input ?? ''}
                    onChange={(e) => setInput?.(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTodo?.()}
                    placeholder="Add todo..."
                />
                <button onClick={addTodo}>Add</button>
            </div>
            <ul className="todo-list">
                {todos?.map(todo => (
                    <li key={todo.id} className="todo-item">
                        <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={() => toggleTodo?.(todo.id)}
                        />
                        <span className={`todo-text ${todo.completed ? 'completed' : ''}`}>
                            {todo.text}
                        </span>
                        <button onClick={() => removeTodo?.(todo.id)}>×</button>
                    </li>
                ))}
            </ul>
            {todos?.some(t => t.completed) && (
                <button onClick={clearCompleted}>Clear Completed</button>
            )}
        </article>
    )
}

export default TodoExample
