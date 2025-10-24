import { createRootCtx, createAutoCtx } from '../../index'
import { useState } from 'react'

export interface Todo {
    id: string
    text: string
    completed: boolean
}

const useTodoState = ({ listId }: { listId: string }) => {
    const [todos, setTodos] = useState<Todo[]>([])
    const [input, setInput] = useState('')

    const addTodo = () => {
        if (input.trim()) {
            setTodos(prev => [...prev, {
                id: Date.now().toString(),
                text: input.trim(),
                completed: false
            }])
            setInput('')
        }
    }

    const toggleTodo = (id: string) => {
        setTodos(prev => prev.map(t =>
            t.id === id ? { ...t, completed: !t.completed } : t
        ))
    }

    const removeTodo = (id: string) => {
        setTodos(prev => prev.filter(t => t.id !== id))
    }

    const clearCompleted = () => {
        setTodos(prev => prev.filter(t => !t.completed))
    }

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

export const { useCtxState: useTodoCtx } = createAutoCtx(
    createRootCtx("todos", useTodoState),
    5000
)
