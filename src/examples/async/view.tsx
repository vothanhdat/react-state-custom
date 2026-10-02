import { useState } from 'react'
import { useUserStore } from './state'

const box = { padding: '1rem', border: '1px solid #ccc', marginBottom: '1rem' }

export const UserCard = ({ userId }: { userId: string }) => {
    const { user, error, isLoading, reload } = useUserStore({ userId })

    return (
        <div style={box}>
            <h3>User card: {userId}</h3>
            {isLoading && <p>Loading…</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {user && (
                <dl style={{ margin: 0 }}>
                    <dt>Name</dt><dd>{user.name}</dd>
                    <dt>Role</dt><dd>{user.role}</dd>
                    <dt>Email</dt><dd>{user.email}</dd>
                </dl>
            )}
            <button onClick={reload} disabled={isLoading}>Reload</button>
        </div>
    )
}

// A second consumer of the same store: shares the request and the data.
export const UserBadge = ({ userId }: { userId: string }) => {
    const { user, isLoading } = useUserStore({ userId })
    return (
        <span style={{ padding: '0.25rem 0.5rem', border: '1px solid #ccc', borderRadius: '1rem' }}>
            {isLoading ? '…' : user?.name ?? 'unknown'}
        </span>
    )
}

// Unmount the card and remount within 10s: data is still there, no new request.
export const ToggleableUserCard = ({ userId }: { userId: string }) => {
    const [shown, setShown] = useState(true)
    return (
        <div>
            <button onClick={() => setShown(s => !s)} style={{ marginBottom: '0.5rem' }}>
                {shown ? 'Unmount' : 'Mount'} card for {userId}
            </button>
            {shown && <UserCard userId={userId} />}
        </div>
    )
}

export default UserCard
