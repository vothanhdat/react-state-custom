import { useState } from 'react'
import { useUserStore } from './state'

export const UserCard = ({ userId }: { userId: string }) => {
    const { user, error, isLoading, reload } = useUserStore({ userId })
    // every key is undefined until the store has run once: that is loading too
    const loading = isLoading !== false

    return (
        <div className="card">
            <h3>User <small>{userId}</small></h3>
            {loading && <p>Loading…</p>}
            {error && <p className="error">{error}</p>}
            {user && <p>{user.name} · {user.role} · {user.email}</p>}
            <button onClick={reload} disabled={loading}>Reload</button>
        </div>
    )
}

// A second consumer of the same store: shares the request and the data.
export const UserBadge = ({ userId }: { userId: string }) => {
    const { user, isLoading } = useUserStore({ userId })
    return <strong>{isLoading !== false ? '…' : user?.name ?? 'unknown'}</strong>
}

// Unmount the card and remount within 10s: data is still there, no new request.
export const ToggleableUserCard = ({ userId }: { userId: string }) => {
    const [shown, setShown] = useState(true)
    return (
        <>
            <p className="row">
                <button onClick={() => setShown(s => !s)}>{shown ? 'Unmount' : 'Mount'} card</button>
                Badge for the same user: <UserBadge userId={userId} />
            </p>
            {shown && <UserCard userId={userId} />}
        </>
    )
}

export default UserCard
