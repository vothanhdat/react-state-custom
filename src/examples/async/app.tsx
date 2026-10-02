import { ToggleableUserCard, UserBadge, UserCard } from './view'

export default function App() {
    return (
        <>
            <p>
                Badge and card for the same user share one store, so one request:{' '}
                <UserBadge userId="ada" />
            </p>
            <ToggleableUserCard userId="ada" />
            <UserCard userId="linus" />
            <UserCard userId="nobody" />
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
                Async data with a plain useEffect inside the store hook. initialState gives
                consumers a loading state on the first render, timeToClean keeps the result
                cached for 10s after the last consumer unmounts.
            </p>
        </>
    )
}
