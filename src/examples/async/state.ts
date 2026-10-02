import { createStore } from '../../index'
import { useEffect, useState } from 'react'

export interface User {
    id: string
    name: string
    role: string
    email: string
}

const USERS: Record<string, User> = {
    ada: { id: 'ada', name: 'Ada Lovelace', role: 'Engineer', email: 'ada@example.com' },
    linus: { id: 'linus', name: 'Linus Torvalds', role: 'Maintainer', email: 'linus@example.com' },
}

// Fake network call: 0.8s to 1.6s, fails for unknown ids.
const fetchUser = (id: string) =>
    new Promise<User>((resolve, reject) => {
        setTimeout(() => {
            const user = USERS[id]
            user ? resolve(user) : reject(new Error(`User "${id}" not found`))
        }, 800 + Math.random() * 800)
    })

const useUserState = ({ userId }: { userId: string }) => {
    const [user, setUser] = useState<User | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [attempt, setAttempt] = useState(0)

    // Plain useEffect: one request per store instance, no matter how many consumers.
    useEffect(() => {
        let cancelled = false
        setIsLoading(true)
        setError(null)
        fetchUser(userId)
            .then(u => { if (!cancelled) setUser(u) })
            .catch((e: Error) => { if (!cancelled) setError(e.message) })
            .finally(() => { if (!cancelled) setIsLoading(false) })
        return () => { cancelled = true }
    }, [userId, attempt])

    const reload = () => setAttempt(n => n + 1)

    return { user, error, isLoading, reload }
}

export const { useStore: useUserStore } = createStore('user', useUserState, {
    // Shown on the very first render (and in server-rendered HTML).
    initialState: { user: null, error: null, isLoading: true },
    // Keep fetched data 10s after the last consumer unmounts: remount within
    // that window and there is no refetch.
    timeToClean: 10000,
})
