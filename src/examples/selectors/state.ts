import { createStore } from '../../index'
import { useEffect, useState } from 'react'

export interface Profile {
    name: string
    tags: string[]
    likes: number
}

// Fake network call, 1s.
const fetchProfile = (userId: string) =>
    new Promise<Profile>(resolve =>
        setTimeout(() => resolve({ name: `User ${userId}`, tags: ['react', 'hooks'], likes: 0 }), 1000)
    )

const useProfileState = ({ userId }: { userId: string }) => {
    const [profile, setProfile] = useState<Profile | null>(null)

    useEffect(() => {
        let cancelled = false
        fetchProfile(userId).then(p => { if (!cancelled) setProfile(p) })
        return () => { cancelled = true }
    }, [userId])

    // Every action replaces the whole `profile` object, so a consumer that reads
    // `profile` re-renders on each of them. Selectors pick out what matters.
    const like = () => setProfile(p => p && { ...p, likes: p.likes + 1 })
    const rename = () => setProfile(p => p && { ...p, name: p.name + '!' })
    const addTag = () => setProfile(p => p && { ...p, tags: [...p.tags, `tag${p.tags.length + 1}`] })

    return { profile, isLoading: !profile, like, rename, addTag }
}

export const { useStore: useProfileStore, useStoreSuspense: useProfileStoreSuspense } =
    createStore('profile', useProfileState, {
        initialState: { profile: null, isLoading: true },
    })
