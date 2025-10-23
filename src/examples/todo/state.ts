import { createRootCtx, createAutoCtx } from '../../index'
import { useCallback, useState } from 'react'

export interface Todo {
    id: string
    text: string
    completed: boolean
}

export const { useCtxState: useTodoCtx } = createAutoCtx(
    createRootCtx(
        "todos",
        ({ listId }: { listId: string }) => {
            const [todos, setTodos] = useState<Todo[]>([])
            const [input, setInput] = useState('')

            const addTodo = useCallback(() => {
                if (input.trim()) {
                    setTodos(prev => [...prev, {
                        id: Date.now().toString(),
                        text: input.trim(),
                        completed: false
                    }])
                    setInput('')
                }
            }, [input])

            const toggleTodo = useCallback((id: string) => {
                setTodos(prev => prev.map(t =>
                    t.id === id ? { ...t, completed: !t.completed } : t
                ))
            }, [])

            const removeTodo = useCallback((id: string) => {
                setTodos(prev => prev.filter(t => t.id !== id))
            }, [])

            const clearCompleted = useCallback(() => {
                setTodos(prev => prev.filter(t => !t.completed))
            }, [])

            return {
                listId,
                todos,
                input,
                setInput,
                addTodo,
                toggleTodo,
                removeTodo,
                clearCompleted,
            }
        }
    ),
    20000
)
