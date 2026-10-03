import { useRef } from 'react'
import { useProfileStore, useProfileStoreSuspense } from './state'

// Counts renders of the calling component, to show which updates reach it.
const useRenderCount = () => {
    const count = useRef(0)
    count.current += 1
    return count.current
}

// Reads the whole `profile` key: re-renders on like, rename and addTag.
export const Editor = ({ userId }: { userId: string }) => {
    const { profile, like, rename, addTag } = useProfileStore({ userId })
    const renders = useRenderCount()
    return (
        <div className="card">
            <h3>profile key <small>renders: {renders}</small></h3>
            <div className="row">
                <button onClick={like} disabled={!profile}>Like</button>
                <button onClick={rename} disabled={!profile}>Rename</button>
                <button onClick={addTag} disabled={!profile}>Add tag</button>
            </div>
        </div>
    )
}

// Selector: only the like count. Rename and addTag do not re-render this.
export const LikeCount = ({ userId }: { userId: string }) => {
    const likes = useProfileStore({ userId }, s => s.profile?.likes ?? 0)
    const renders = useRenderCount()
    return (
        <div className="card">
            <h3>selector: likes <small>renders: {renders}</small></h3>
            {likes} likes
        </div>
    )
}

// Selector returning an array: with an isEqual, a fresh array with the same items is not a change.
const sameItems = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

export const TagList = ({ userId }: { userId: string }) => {
    const tags = useProfileStore({ userId }, s => s.profile?.tags ?? [], sameItems)
    const renders = useRenderCount()
    return (
        <div className="card">
            <h3>selector: tags <small>renders: {renders}</small></h3>
            {tags.join(', ') || '—'}
        </div>
    )
}

// Suspense: no loading branch here. The nearest <Suspense> shows its fallback until isReady holds.
export const ProfileName = ({ userId }: { userId: string }) => {
    const { profile } = useProfileStoreSuspense({ userId }, s => !s.isLoading)
    return (
        <div className="card">
            <h3>useStoreSuspense</h3>
            {profile?.name}
        </div>
    )
}

export default Editor
