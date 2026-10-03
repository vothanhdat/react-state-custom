import { ToggleableUserCard, UserCard } from './view'

export default function App() {
    return (
        <>
            <ToggleableUserCard userId="ada" />
            <UserCard userId="linus" />
            <UserCard userId="nobody" />
        </>
    )
}
